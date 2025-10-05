const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} = require("discord.js");

const GUILD_ID = "841699180271239218";

const LOG_CHANNEL_ID = "1350108952041492561";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a user from the server")
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("The user to kick")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("reason")
                .setDescription("The reason for kicking the user")
                .setRequired(false)
        ),

    // Guild-specific command
    guildCommand: true,
    guildId: GUILD_ID,

    async execute(interaction) {
        try {
            // Check if the user has permission to kick members
            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.KickMembers
                )
            ) {
                await interaction.reply({
                    content:
                        "You need the Kick Members permission to use this command.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            // Get command options
            const targetUser = interaction.options.getUser("user");
            const reason =
                interaction.options.getString("reason") || "No reason provided";

            // Get the member from the user
            const targetMember = await interaction.guild.members
                .fetch(targetUser.id)
                .catch((error) => {
                    console.error(
                        `Failed to fetch member ${targetUser.id}:`,
                        error
                    );
                    return null;
                });

            if (!targetMember) {
                await interaction.reply({
                    content:
                        "Failed to fetch the member. They might not be in this server.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            // Check if the member is kickable by the bot
            if (!targetMember.kickable) {
                await interaction.reply({
                    content:
                        "I cannot kick this user. They might have higher permissions than me.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            // Check if the target is higher in the role hierarchy than the command user
            if (
                targetMember.roles.highest.position >=
                    interaction.member.roles.highest.position &&
                interaction.user.id !== interaction.guild.ownerId
            ) {
                await interaction.reply({
                    content:
                        "You cannot kick someone with a higher or equal role than you.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            // Defer the reply since kicking might take a moment
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            try {
                // Kick the member
                await targetMember.kick(
                    `Kicked by ${interaction.user.tag}: ${reason}`
                );

                // Send success message to the user who executed the command
                await interaction.followUp({
                    content: `✅ ${targetUser.toString()} has been kicked from the server.\nReason: ${reason}`,
                    flags: MessageFlags.Ephemeral,
                });

                // Send notification to the log channel
                try {
                    const logChannel = await interaction.guild.channels.fetch(
                        LOG_CHANNEL_ID
                    );
                    if (logChannel) {
                        await logChannel.send({
                            content: `${interaction.user.toString()} kicked ${targetUser.toString()} for reason: ${reason}`,
                        });
                    }
                } catch (logError) {
                    console.error("Failed to send log message:", logError);
                }
            } catch (kickError) {
                console.error("Error kicking member:", kickError);
                await interaction.followUp({
                    content: `Error kicking user: ${kickError.message}`,
                    flags: MessageFlags.Ephemeral,
                });
            }
        } catch (error) {
            console.error("Error in kick command:", error);

            // Reply with error message
            try {
                if (interaction.deferred) {
                    await interaction.followUp({
                        content: `An error occurred: ${error.message}`,
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    await interaction.reply({
                        content: `An error occurred: ${error.message}`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
            } catch (replyError) {
                console.error("Failed to send error reply:", replyError);
            }
        }
    },
};
