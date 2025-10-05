const { SlashCommandBuilder, MessageFlags } = require("discord.js");

const GUILD_ID = "841699180271239218";

const BOOSTER_ROLE_ID = "855954434935619584";

const MIN_ROLE_ID = "1424000379712045237"; // lower bound
const MAX_ROLE_ID = "1424000711183826995"; // upper bound

const LOG_CHANNEL_ID = "1350108952041492561";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("custom-role")
        .setDescription(
            "Booster commands to create or edit a personal custom role."
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("create")
                .setDescription("Create a new custom role (boosters only).")
                .addStringOption((option) =>
                    option
                        .setName("name")
                        .setDescription("The name for your new custom role.")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("color")
                        .setDescription(
                            "A hex color for your role (e.g., #FF5733). Optional."
                        )
                        .setRequired(false)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("edit")
                .setDescription(
                    "Edit your existing custom role (boosters only)."
                )
                .addStringOption((option) =>
                    option
                        .setName("name")
                        .setDescription("The new name for your custom role.")
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName("color")
                        .setDescription(
                            "The new hex color for your role (e.g., #FF5733)."
                        )
                        .setRequired(false)
                )
        ),

    guildCommand: true,
    guildId: GUILD_ID,

    async execute(interaction) {
        // 1. Initial Checks (Booster status & Defer)
        if (!interaction.member.roles.cache.has(BOOSTER_ROLE_ID)) {
            return interaction.reply({
                content:
                    "This command is a special perk for server boosters. Please boost the server to use it!",
                flags: MessageFlags.Ephemeral,
            });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const subcommand = interaction.options.getSubcommand();
            const member = interaction.member;

            // 2. Find role boundaries and user's existing custom role (common logic)
            const { existingUserRole } = await findUserCustomRole(interaction);

            // 3. Route to the correct subcommand logic
            if (subcommand === "create") {
                await handleCreate(interaction, member, existingUserRole);
            } else if (subcommand === "edit") {
                await handleEdit(interaction, member, existingUserRole);
            }
        } catch (error) {
            console.error("Error in custom-role command:", error);
            const errorMessage = `An error occurred: ${error.message}. If this persists, please contact an admin.`;
            await interaction.followUp({
                content: errorMessage,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};

async function handleCreate(interaction, member, existingUserRole) {
    if (existingUserRole) {
        return interaction.followUp({
            content: `You already have a custom role (<@&${existingUserRole.id}>). Use \`/custom-role edit\` to modify it.`,
            flags: MessageFlags.Ephemeral,
        });
    }

    const roleName = interaction.options.getString("name");
    const roleColor = validateColor(interaction.options.getString("color"));

    if (roleColor === false) {
        return interaction.followUp({
            content:
                "The color you provided is not a valid hex code. Please use a format like `#FF5733` or `FF5733`.",
            flags: MessageFlags.Ephemeral,
        });
    }

    const maxRole = await interaction.guild.roles.fetch(MAX_ROLE_ID);
    if (!maxRole) throw new Error("Upper boundary role not found.");

    const newRole = await interaction.guild.roles.create({
        name: roleName,
        color: roleColor,
        permissions: [],
        position: maxRole.position - 1,
        reason: `Custom role created for booster ${interaction.user.tag}`,
    });

    await member.roles.add(newRole.id);

    await interaction.followUp({
        content: `✅ Your new custom role <@&${newRole.id}> has been created and assigned to you!`,
        flags: MessageFlags.Ephemeral,
    });

    // Send log message
    await sendLogMessage(interaction, "created", newRole, member);
}

/**
 * Handles the logic for the `/custom-role edit` subcommand.
 */
async function handleEdit(interaction, member, existingUserRole) {
    if (!existingUserRole) {
        return interaction.followUp({
            content:
                "You do not have a custom role to edit. Use `/custom-role create` to make one first.",
            flags: MessageFlags.Ephemeral,
        });
    }

    const roleName = interaction.options.getString("name");
    const roleColor = validateColor(interaction.options.getString("color"));

    if (roleColor === false) {
        return interaction.followUp({
            content:
                "The color you provided is not a valid hex code. Please use a format like `#FF5733` or `FF5733`.",
            flags: MessageFlags.Ephemeral,
        });
    }

    if (!roleName && !roleColor) {
        return interaction.followUp({
            content:
                "You must provide a new name, a new color, or both to edit your role.",
            flags: MessageFlags.Ephemeral,
        });
    }

    const updatedRole = await existingUserRole.edit({
        name: roleName || existingUserRole.name,
        color: roleColor || existingUserRole.color,
        reason: `Custom role updated for booster ${interaction.user.tag}`,
    });

    await interaction.followUp({
        content: `✅ Your custom role <@&${updatedRole.id}> has been successfully updated!`,
        flags: MessageFlags.Ephemeral,
    });

    // Send log message
    await sendLogMessage(interaction, "edited", updatedRole, member);
}

/**
 * Finds the boundaries for custom roles and checks if the user already has one.
 */
async function findUserCustomRole(interaction) {
    const minRole = await interaction.guild.roles.fetch(MIN_ROLE_ID);
    const maxRole = await interaction.guild.roles.fetch(MAX_ROLE_ID);

    if (!minRole || !maxRole) {
        throw new Error("Custom role boundaries are not configured correctly.");
    }

    const lowerBoundPos = Math.min(minRole.position, maxRole.position);
    const upperBoundPos = Math.max(minRole.position, maxRole.position);

    const customRolesInCategory = interaction.guild.roles.cache.filter(
        (role) => role.position > lowerBoundPos && role.position < upperBoundPos
    );

    const existingUserRole =
        interaction.member.roles.cache.find((role) =>
            customRolesInCategory.has(role.id)
        ) || null;

    return { existingUserRole };
}

/**
 * Validates and formats a hex color string.
 */
function validateColor(color) {
    if (!color) return null;
    if (!color.startsWith("#")) {
        color = `#${color}`;
    }
    const hexColorRegex = /^#([0-9A-F]{3}){1,2}$/i;
    return hexColorRegex.test(color) ? color : false;
}

/**
 * Sends a formatted log message to the designated log channel.
 */
async function sendLogMessage(interaction, action, role, member) {
    try {
        const logChannel = await interaction.guild.channels.fetch(
            LOG_CHANNEL_ID
        );
        if (!logChannel || !logChannel.isTextBased()) {
            console.error(
                `Log channel with ID ${LOG_CHANNEL_ID} not found or is not a text channel.`
            );
            return;
        }

        const logMessage = `Booster ${member.toString()} has ${action} custom role ${role.toString()}`;

        await logChannel.send(logMessage);
    } catch (error) {
        console.error("Failed to send log message:", error);
    }
}
