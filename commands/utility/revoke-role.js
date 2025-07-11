const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Guild ID for guild-specific command
const GUILD_ID = '841699180271239218';

// The target role IDs to check between
const MIN_ROLE_ID = '1375397609908469800';  // lower bound
const MAX_ROLE_ID = '1375397935050919997';  // upper bound

// Special roles that allow users to keep roles between MIN and MAX
const SPECIAL_ROLES = [
    '855954434935619584',  // Booster role
    '842053547301273642',  // VIP Pass
    '862616575890030592',  // Admins
    '857990235194261514',  // Staff
    '860393593259425813',  // Dino Whisperer
    '843856166994968597',  // lvl roles
    '843856481288060978',  // lvl roles
    '843856587469750333',  // lvl roles
    '843856716382208020',  // lvl roles
    '843856730232324148'   // lvl roles
];

// The booster role ID - users must have this to keep custom roles
const BOOSTER_ROLE_ID = '855954434935619584';

// Path to the custom roles data file
const CUSTOM_ROLES_PATH = path.join(__dirname, '../../data/custom-roles.json');

// Helper function to load custom roles data
function loadCustomRoles() {
    try {
        if (!fs.existsSync(CUSTOM_ROLES_PATH)) {
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
        .setName('revoke-role')
        .setDescription('List and manage users with roles between specified role IDs')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addBooleanOption(option =>
            option.setName('execute')
                .setDescription('If true, actually remove unauthorized roles; if false, just show what would be removed')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('listall')
                .setDescription('If true, list all users with these roles; if false, only list users without special roles')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('customroles')
                .setDescription('If true, also check and remove custom roles from non-boosters')
                .setRequired(false)),

    // Guild-specific command
    guildCommand: true,
    guildId: GUILD_ID,

    async execute(interaction) {
        try {
            // Double-check for Manage Roles permission even if the command registration restricts it
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
                await interaction.reply({
                    content: 'You need the Manage Roles permission to use this command.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Get command options
            const shouldExecute = interaction.options.getBoolean('execute') || false;
            const listAll = interaction.options.getBoolean('listall') || false;
            const checkCustomRoles = interaction.options.getBoolean('customroles') || false;

            // Defer the reply since fetching all members might take a moment
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            try {
                // Fetch all members in the guild
                await interaction.guild.members.fetch();

                let response = '';
                let processedResponse = '';

                // Create separate sections for the regular role check and custom role check
                if (checkCustomRoles) {
                    // Check custom roles for non-boosters
                    const customRolesResponse = await processCustomRoles(interaction.guild, shouldExecute);
                    processedResponse = customRolesResponse;
                }

                // Process regular roles between min and max
                const regularRolesResponse = await processRegularRoles(
                    interaction.guild,
                    shouldExecute,
                    listAll
                );

                // Combine the responses with a section separator if needed
                if (processedResponse && regularRolesResponse) {
                    response = regularRolesResponse + "\n\n" + "-------------------\n\n" + processedResponse;
                } else if (processedResponse) {
                    response = processedResponse;
                } else {
                    response = regularRolesResponse;
                }

                // Send the response (handle case where response is too long)
                if (response.length > 2000) {
                    const firstPart = response.substring(0, 1900) + `\n\n... [Output truncated due to length]`;
                    await interaction.followUp({
                        content: firstPart,
                        flags: MessageFlags.Ephemeral
                    });

                    // Send a notice that the output was truncated
                    await interaction.followUp({
                        content: 'The output was too long and was truncated. Use the command in smaller batches or check roles individually.',
                        flags: MessageFlags.Ephemeral
                    });
                } else {
                    await interaction.followUp({
                        content: response,
                        flags: MessageFlags.Ephemeral
                    });
                }

            } catch (error) {
                console.error('Error during role revocation:', error);
                await interaction.followUp({
                    content: `An error occurred: ${error.message}`,
                    flags: MessageFlags.Ephemeral
                });
            }

        } catch (error) {
            console.error('Error in revoke-role command:', error);

            // Reply with error message if the interaction hasn't been replied to
            if (interaction.deferred) {
                await interaction.followUp({
                    content: `An error occurred: ${error.message}`,
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await interaction.reply({
                    content: `An error occurred: ${error.message}`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
};

// Helper function to process regular roles between min and max
async function processRegularRoles(guild, shouldExecute, listAll) {
    // Get the min and max role objects to determine position
    const minRole = await guild.roles.fetch(MIN_ROLE_ID);
    const maxRole = await guild.roles.fetch(MAX_ROLE_ID);

    if (!minRole || !maxRole) {
        return 'One or both of the specified roles could not be found.';
    }

    // Fetch all special roles
    const specialRoles = [];
    for (const roleId of SPECIAL_ROLES) {
        const role = await guild.roles.fetch(roleId);
        if (role) specialRoles.push(role);
    }

    // Get all roles in the guild
    const roles = await guild.roles.fetch();

    // Filter roles that are STRICTLY between min and max roles in the hierarchy
    // (excluding the boundary roles themselves)
    const targetRoles = roles.filter(role => {
        return role.position > minRole.position &&
            role.position < maxRole.position &&
            role.id !== MIN_ROLE_ID &&
            role.id !== MAX_ROLE_ID;
    });

    if (targetRoles.size === 0) {
        return 'No roles found between the specified role positions.';
    }

    // Track statistics for execute mode
    let usersLackingSpecialRoles = 0;
    let rolesRemoved = 0;
    let failedRemovals = 0;

    // For the regular format, we'll organize by role
    const roleMap = new Map();
    targetRoles.forEach(role => {
        roleMap.set(role.id, {
            role,
            allUsers: [],         // All users with this role
            unauthorizedUsers: [] // Users who don't have special roles
        });
    });

    // Map to store users who lack special roles but have target roles (for execute mode)
    const usersToProcess = new Map();

    // Process all members to check which roles they have
    guild.members.cache.forEach(member => {
        // Check if the user has any special roles
        const hasSpecialRole = specialRoles.some(specialRole =>
            member.roles.cache.has(specialRole.id)
        );

        // Check which target roles this member has
        const memberTargetRoles = member.roles.cache.filter(role =>
            targetRoles.has(role.id)
        );

        if (memberTargetRoles.size > 0) {
            // Add to the role map for display
            memberTargetRoles.forEach(role => {
                if (roleMap.has(role.id)) {
                    // Add to all users
                    roleMap.get(role.id).allUsers.push(member);

                    // If they don't have special roles, add to unauthorized users
                    if (!hasSpecialRole) {
                        roleMap.get(role.id).unauthorizedUsers.push(member);
                    }
                }
            });

            // If they don't have special roles, mark for removal in execute mode
            if (!hasSpecialRole) {
                usersLackingSpecialRoles++;
                usersToProcess.set(member.id, {
                    member,
                    rolesToRemove: Array.from(memberTargetRoles.values())
                });
            }
        }
    });

    // Build the response based on whether we're executing or just displaying
    let response = '';

    if (!shouldExecute) {
        // Format the output by role with mentioned users as requested
        response = '# Exclusive Roles Check\n\n';

        // Sort roles by position (highest first)
        const sortedRoles = Array.from(roleMap.values())
            .sort((a, b) => b.role.position - a.role.position);

        for (const { role, allUsers, unauthorizedUsers } of sortedRoles) {
            // If listAll is true, show all users; otherwise only show unauthorized users
            const usersToDisplay = listAll ? allUsers : unauthorizedUsers;

            if (usersToDisplay.length > 0) {
                response += `### <@&${role.id}>\n`;

                // Show unauthorized status if listing all users
                if (listAll) {
                    usersToDisplay.forEach(user => {
                        const hasSpecialRole = specialRoles.some(specialRole =>
                            user.roles.cache.has(specialRole.id)
                        );
                        const status = hasSpecialRole ? "" : " ⚠️"; // Warning for users without special roles
                        response += `- <@${user.id}>${status}\n`;
                    });
                } else {
                    // Only showing unauthorized users
                    usersToDisplay.forEach(user => {
                        response += `- <@${user.id}>\n`;
                    });
                }
                response += '\n';
            }
        }

        // Add information about unauthorized users
        if (usersToProcess.size > 0) {
            if (listAll) {
                response += `\n## Note\n⚠️ = Users without special roles (${usersToProcess.size} total)`;
                response += `\nThese users would have their roles removed if you run with \`execute:true\`.\n\n`;
            } else {
                response += `\n## Users without special roles (${usersToProcess.size} total)\n`;
                response += `Only these users are shown above. They would have their roles removed if you run with \`execute:true\`.\n\n`;
            }
        } else {
            response += `\nNo users found without special roles. No action needed.\n`;
        }
    } else {
        // Execute mode - remove roles and show results
        response = '# Role Removal Results\n\n';

        if (usersToProcess.size === 0) {
            response += `No unauthorized roles found. No changes made.\n`;
        } else {
            response += `## Users processed:\n\n`;

            for (const [userId, { member, rolesToRemove }] of usersToProcess.entries()) {
                response += `### <@${userId}>\n`;
                response += `Roles removed:\n`;

                for (const role of rolesToRemove) {
                    try {
                        await member.roles.remove(role, 'Removed by revoke-role command - no special roles');
                        response += `- <@&${role.id}>\n`;
                        rolesRemoved++;
                    } catch (error) {
                        failedRemovals++;
                        console.error(`Failed to remove role ${role.name} from ${member.user.tag}:`, error);
                        response += `- <@&${role.id}> ⚠️ Failed: ${error.message}\n`;
                    }
                }
                response += '\n';
            }

            // Add summary stats
            response += `\n## Summary\n`;
            response += `- Users processed: ${usersToProcess.size}\n`;
            response += `- Roles successfully removed: ${rolesRemoved}\n`;
            response += `- Failed removals: ${failedRemovals}\n`;
            response += `\n**Action completed.**\n`;
        }
    }

    return response;
}

// Helper function to process custom roles from non-boosters
async function processCustomRoles(guild, shouldExecute) {
    // Load the custom roles data
    const customRolesData = loadCustomRoles();

    if (!customRolesData.roles[guild.id]) {
        return '# Custom Roles Check\n\nNo custom roles data found for this server.';
    }

    const usersToProcess = new Map();
    let customRolesFound = 0;
    let customRolesToRemove = 0;
    let rolesRemoved = 0;
    let rolesDeleted = 0;
    let failedRemovals = 0;

    // Check each user in the custom roles data
    for (const [userId, roleId] of Object.entries(customRolesData.roles[guild.id])) {
        customRolesFound++;

        try {
            // Try to fetch the member and role
            const member = await guild.members.fetch(userId).catch(() => null);
            const role = await guild.roles.fetch(roleId).catch(() => null);

            // If either the member or role doesn't exist, skip
            if (!member || !role) {
                // If we're executing, clean up the entry from the data
                if (shouldExecute && (member === null || role === null)) {
                    delete customRolesData.roles[guild.id][userId];
                    if (role && !member) {
                        // If role exists but member doesn't, delete the role
                        try {
                            await role.delete('User no longer in the server');
                            rolesDeleted++;
                        } catch (error) {
                            console.error(`Failed to delete role ${roleId}:`, error);
                            failedRemovals++;
                        }
                    }
                }
                continue;
            }

            // Check if the member still has the booster role
            const hasBoosterRole = member.roles.cache.has(BOOSTER_ROLE_ID);

            if (!hasBoosterRole) {
                customRolesToRemove++;
                usersToProcess.set(userId, { member, role });
            }
        } catch (error) {
            console.error(`Error processing custom role for user ${userId}:`, error);
        }
    }

    // Now build the response
    let response = '# Custom Roles Check\n\n';

    if (customRolesFound === 0) {
        response += 'No custom roles found in the database.\n';
        return response;
    }

    if (usersToProcess.size === 0) {
        response += `Found ${customRolesFound} custom role(s). All users have the booster role. No action needed.\n`;
        return response;
    }

    if (!shouldExecute) {
        // Just show what would happen
        response += `## Users without booster role who have custom roles:\n\n`;

        for (const [userId, { member, role }] of usersToProcess.entries()) {
            response += `### <@${userId}>\n`;
            response += `Custom role: <@&${role.id}> (${role.name})\n\n`;
        }

        response += `\nFound ${customRolesToRemove} users without booster role who have custom roles.\n`;
        response += `These roles would be removed and deleted if you run with \`execute:true customroles:true\`.\n`;
    } else {
        // Execute mode - remove and delete the roles
        response += `## Users processed:\n\n`;

        for (const [userId, { member, role }] of usersToProcess.entries()) {
            response += `### <@${userId}>\n`;

            try {
                // Remove the role from the user
                await member.roles.remove(role, 'Removed by revoke-role command - user is not a booster');
                response += `- Removed role <@&${role.id}> (${role.name})\n`;
                rolesRemoved++;

                // Delete the role
                try {
                    await role.delete('User is not a booster anymore');
                    response += `- Deleted role <@&${role.id}> (${role.name})\n`;
                    rolesDeleted++;
                } catch (deleteError) {
                    console.error(`Failed to delete role ${role.id}:`, deleteError);
                    response += `- ⚠️ Failed to delete role: ${deleteError.message}\n`;
                    failedRemovals++;
                }

                // Clean up the entry from the data
                delete customRolesData.roles[guild.id][userId];
            } catch (error) {
                console.error(`Failed to remove role ${role.id} from ${member.user.tag}:`, error);
                response += `- ⚠️ Failed to remove role: ${error.message}\n`;
                failedRemovals++;
            }

            response += '\n';
        }

        // Save the updated custom roles data
        saveCustomRoles(customRolesData);

        // Add summary stats
        response += `\n## Summary\n`;
        response += `- Users processed: ${usersToProcess.size}\n`;
        response += `- Roles successfully removed: ${rolesRemoved}\n`;
        response += `- Roles successfully deleted: ${rolesDeleted}\n`;
        response += `- Failed operations: ${failedRemovals}\n`;
        response += `\n**Action completed.**\n`;
    }

    return response;
} 