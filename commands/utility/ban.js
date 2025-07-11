const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

// Guild ID for guild-specific command
const GUILD_ID = '841699180271239218';

// Log channel for moderation actions
const LOG_CHANNEL_ID = '1350108952041492561';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban or unban a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to ban or unban')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('unban')
                .setDescription('If true, unban the user instead of banning them')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for banning/unbanning the user')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('Number of days of messages to delete (0-7, only for ban)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false)),

    // Guild-specific command
    guildCommand: true,
    guildId: GUILD_ID,

    async execute(interaction) {
        try {
            // Check if the user has permission to ban members
            if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
                await interaction.reply({
                    content: 'You need the Ban Members permission to use this command.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Get command options
            const targetUser = interaction.options.getUser('user');
            const shouldUnban = interaction.options.getBoolean('unban') || false;
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const deleteDays = shouldUnban ? 0 : (interaction.options.getInteger('days') || 0);

            // Defer the reply since banning/unbanning might take a moment
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            if (shouldUnban) {
                // Handle unban
                try {
                    // Get ban info to check if the user is actually banned
                    const banInfo = await interaction.guild.bans.fetch(targetUser.id).catch(() => null);

                    if (!banInfo) {
                        await interaction.followUp({
                            content: `${targetUser.toString()} is not banned from this server.`,
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    // Unban the user
                    await interaction.guild.bans.remove(targetUser.id, `Unbanned by ${interaction.user.tag}: ${reason}`);

                    // Send success message
                    await interaction.followUp({
                        content: `✅ ${targetUser.toString()} has been unbanned from the server.\nReason: ${reason}`,
                        flags: MessageFlags.Ephemeral
                    });

                    // Send notification to the log channel
                    try {
                        const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID);
                        if (logChannel) {
                            await logChannel.send({
                                content: `${interaction.user.toString()} unbanned ${targetUser.toString()} for reason: ${reason}`
                            });
                        }
                    } catch (logError) {
                        console.error('Failed to send log message:', logError);
                    }
                } catch (unbanError) {
                    console.error('Error unbanning user:', unbanError);
                    await interaction.followUp({
                        content: `Error unbanning user: ${unbanError.message}`,
                        flags: MessageFlags.Ephemeral
                    });
                }
            } else {
                // Handle ban
                try {
                    // Get member if they're in the server
                    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

                    // If user is in the server, perform additional checks
                    if (targetMember) {
                        // Check if the member is bannable by the bot
                        if (!targetMember.bannable) {
                            await interaction.followUp({
                                content: 'I cannot ban this user. They might have higher permissions than me.',
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        // Check if the target is higher in the role hierarchy than the command user
                        if (targetMember.roles.highest.position >= interaction.member.roles.highest.position &&
                            interaction.user.id !== interaction.guild.ownerId) {
                            await interaction.followUp({
                                content: 'You cannot ban someone with a higher or equal role than you.',
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }
                    }

                    // Ban the user
                    await interaction.guild.members.ban(targetUser.id, {
                        deleteMessageDays: deleteDays,
                        reason: `Banned by ${interaction.user.tag}: ${reason}`
                    });

                    // Send success message
                    await interaction.followUp({
                        content: `✅ ${targetUser.toString()} has been banned from the server.\nReason: ${reason}`,
                        flags: MessageFlags.Ephemeral
                    });

                    // Send notification to the log channel
                    try {
                        const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID);
                        if (logChannel) {
                            await logChannel.send({
                                content: `${interaction.user.toString()} banned ${targetUser.toString()} for reason: ${reason}`
                            });
                        }
                    } catch (logError) {
                        console.error('Failed to send log message:', logError);
                    }
                } catch (banError) {
                    console.error('Error banning user:', banError);
                    await interaction.followUp({
                        content: `Error banning user: ${banError.message}`,
                        flags: MessageFlags.Ephemeral
                    });
                }
            }
        } catch (error) {
            console.error('Error in ban command:', error);

            // Reply with error message
            try {
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
            } catch (replyError) {
                console.error('Failed to send error reply:', replyError);
            }
        }
    }
}; 