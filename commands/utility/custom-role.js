const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Guild ID for guild-specific command
const GUILD_ID = '841699180271239218';

// The booster role ID that's required to use this command
const BOOSTER_ROLE_ID = '855954434935619584';

// The reference role ID - custom roles will be positioned under this role
const REFERENCE_ROLE_ID = '862592252199043082';

// Path to the custom roles data file
const CUSTOM_ROLES_PATH = path.join(__dirname, '../../data/custom-roles.json');

// Helper function to load custom roles data
function loadCustomRoles() {
    try {
        if (!fs.existsSync(CUSTOM_ROLES_PATH)) {
            // Create the file with default structure if it doesn't exist
            fs.writeFileSync(CUSTOM_ROLES_PATH, JSON.stringify({ roles: {} }, null, 4));
            return { roles: {} };
        }

        const data = fs.readFileSync(CUSTOM_ROLES_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading custom roles data:', error);
        return { roles: {} };
    }
}

// Helper function to save custom roles data
function saveCustomRoles(data) {
    try {
        fs.writeFileSync(CUSTOM_ROLES_PATH, JSON.stringify(data, null, 4));
        return true;
    } catch (error) {
        console.error('Error saving custom roles data:', error);
        return false;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('custom-role')
        .setDescription('Create a custom role with your chosen name and color')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The name for your custom role')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('The color for your role in hex format (e.g., #FF5733)')
                .setRequired(true)),

    // Guild-specific command
    guildCommand: true,
    guildId: GUILD_ID,

    async execute(interaction) {
        try {
            // Check if the user has the booster role
            const member = interaction.member;
            if (!member.roles.cache.has(BOOSTER_ROLE_ID)) {
                await interaction.reply({
                    content: 'Please boost the server to unlock this command.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Get the role name and color from the options
            const roleName = interaction.options.getString('name');
            let roleColor = interaction.options.getString('color');

            // Validate and format the color
            if (!roleColor.startsWith('#')) {
                roleColor = `#${roleColor}`;
            }

            // Check if the color is a valid hex color
            const hexColorRegex = /^#([0-9A-F]{3}){1,2}$/i;
            if (!hexColorRegex.test(roleColor)) {
                await interaction.reply({
                    content: 'Please provide a valid hex color code (e.g., #FF5733).',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Defer the reply since creating/editing a role might take a moment
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            // Get the reference role to position our custom role under it
            const referenceRole = await interaction.guild.roles.fetch(REFERENCE_ROLE_ID);
            if (!referenceRole) {
                await interaction.followUp({
                    content: 'Could not find the reference role for positioning. The role will be created but may not be positioned correctly.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Load custom roles data
            const customRolesData = loadCustomRoles();
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;

            // Initialize guild data if it doesn't exist
            if (!customRolesData.roles[guildId]) {
                customRolesData.roles[guildId] = {};
            }

            let roleToUse;
            let isNewRole = true;

            // Check if the user already has a custom role in our data
            if (customRolesData.roles[guildId][userId]) {
                const existingRoleId = customRolesData.roles[guildId][userId];
                try {
                    // Try to fetch the existing role
                    roleToUse = await interaction.guild.roles.fetch(existingRoleId);

                    if (roleToUse) {
                        isNewRole = false;

                        // Edit the existing role
                        await roleToUse.edit({
                            name: roleName,
                            color: roleColor,
                            reason: `Custom role updated for ${interaction.user.tag}`
                        });

                        // Ensure the user still has the role
                        if (!member.roles.cache.has(roleToUse.id)) {
                            await member.roles.add(roleToUse.id);
                        }

                        // Set the position if reference role exists
                        if (referenceRole) {
                            try {
                                // Position just below the reference role
                                await roleToUse.setPosition(referenceRole.position - 1);
                            } catch (posError) {
                                console.error('Error setting role position:', posError);
                                // Continue even if positioning fails
                            }
                        }
                    } else {
                        // Role not found, will create a new one
                        isNewRole = true;
                    }
                } catch (fetchError) {
                    console.error('Error fetching existing role:', fetchError);
                    // Role not found or error, will create a new one
                    isNewRole = true;
                }
            }

            // Create a new role if needed
            if (isNewRole) {
                roleToUse = await interaction.guild.roles.create({
                    name: roleName,
                    color: roleColor,
                    permissions: [],
                    reason: `Custom role created for ${interaction.user.tag}`,
                    position: referenceRole ? referenceRole.position - 1 : 0
                });

                // If the position wasn't set properly during creation, try again
                if (referenceRole && roleToUse.position !== referenceRole.position - 1) {
                    try {
                        await roleToUse.setPosition(referenceRole.position - 1);
                    } catch (posError) {
                        console.error('Error setting role position:', posError);
                        // Continue even if positioning fails
                    }
                }

                // Assign the role to the user
                await member.roles.add(roleToUse.id);

                // Store the role ID in our data
                customRolesData.roles[guildId][userId] = roleToUse.id;
                saveCustomRoles(customRolesData);
            }

            // Send success message
            const actionText = isNewRole ? "created and assigned to you" : "updated";
            await interaction.followUp({
                content: `✅ Your custom role "${roleName}" with color ${roleColor} has been ${actionText}!`,
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Error in custom-role command:', error);

            // Reply with error message if the interaction hasn't been replied to
            if (interaction.deferred) {
                await interaction.followUp({
                    content: `An error occurred while managing your custom role: ${error.message}`,
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await interaction.reply({
                    content: `An error occurred while managing your custom role: ${error.message}`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
}; 