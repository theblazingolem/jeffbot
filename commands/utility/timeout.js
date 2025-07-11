const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

// Guild ID for guild-specific command
const GUILD_ID = '841699180271239218';

// Log channel for moderation actions
const LOG_CHANNEL_ID = '1350108952041492561';

// Duration options in milliseconds
const DURATION_OPTIONS = {
    '5min': 5 * 60 * 1000,
    '15min': 15 * 60 * 1000,
    '30min': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '3h': 3 * 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
    '1month': 28 * 24 * 60 * 60 * 1000
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Manage user timeouts')
        // Add subcommand
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Timeout a user for a specified duration')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to timeout')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('time')
                        .setDescription('The duration of the timeout')
                        .setRequired(true)
                        .addChoices(
                            { name: '5 minutes', value: '5min' },
                            { name: '15 minutes', value: '15min' },
                            { name: '30 minutes', value: '30min' },
                            { name: '1 hour', value: '1h' },
                            { name: '3 hours', value: '3h' },
                            { name: '6 hours', value: '6h' },
                            { name: '12 hours', value: '12h' },
                            { name: '24 hours', value: '24h' },
                            { name: '1 week', value: '1w' },
                            { name: '1 month', value: '1month' }
                        ))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason for the timeout (optional)')
                        .setRequired(false)))
        // Remove subcommand
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a timeout from a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to remove timeout from')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason for removing the timeout (optional)')
                        .setRequired(false))),

    // Guild-specific command - no need for serverRestriction check
    guildCommand: true,
    guildId: GUILD_ID,

    async execute(interaction) {
        try {
            // Check if the user has permission to mute/timeout members
            if (!interaction.member.permissions.has(PermissionFlagsBits.MuteMembers)) {
                await interaction.reply({
                    content: 'You need the Mute Members permission to use this command.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Get the subcommand name
            const subcommand = interaction.options.getSubcommand();

            // Get common options
            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            // Get the member from the user
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(error => {
                console.error(`Failed to fetch member ${targetUser.id}:`, error);
                return null;
            });

            if (!targetMember) {
                await interaction.reply({
                    content: 'Failed to fetch the member. They might not be in this server.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Check if the member is moderatable by the bot
            if (!targetMember.moderatable) {
                await interaction.reply({
                    content: 'I cannot moderate this user. They might have higher permissions than me.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Check if the target is higher in the role hierarchy than the command user
            if (targetMember.roles.highest.position >= interaction.member.roles.highest.position &&
                interaction.user.id !== interaction.guild.ownerId) {
                await interaction.reply({
                    content: 'You cannot timeout someone with a higher or equal role than you.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Handle different subcommands
            try {
                if (subcommand === 'remove') {
                    await handleRemoveTimeout(interaction, targetMember, targetUser, reason);
                } else if (subcommand === 'add') {
                    await handleAddTimeout(interaction, targetMember, targetUser, reason);
                }
            } catch (error) {
                console.error('Error handling timeout operation:', error);
                await interaction.reply({
                    content: `Error processing timeout: ${error.message}`,
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch (error) {
            console.error('Error in timeout command:', error);
            try {
                await interaction.reply({
                    content: `An error occurred: ${error.message}`,
                    flags: MessageFlags.Ephemeral
                });
            } catch (replyError) {
                console.error('Failed to send error reply:', replyError);
            }
        }
    }
};

// Helper function to handle adding timeout
async function handleAddTimeout(interaction, targetMember, targetUser, reason) {
    // Get time option from the add subcommand
    const timeOption = interaction.options.getString('time');

    // Apply timeout
    const duration = DURATION_OPTIONS[timeOption];
    if (!duration) {
        await interaction.reply({
            content: 'Invalid time option provided.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Format the time for display
    const timeDisplay = timeOption
        .replace('min', ' minutes')
        .replace('h', ' hours')
        .replace('w', ' week')
        .replace('month', ' month');

    await targetMember.timeout(duration, `Timeout by ${interaction.user.tag}: ${reason}`);
    await interaction.reply({
        content: `✅ ${targetUser.toString()} has been timed out for ${timeDisplay}.\nReason: ${reason}`,
        flags: MessageFlags.Ephemeral
    });

    // Send notification to the log channel
    try {
        const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel) {
            await logChannel.send({
                content: `${interaction.user.toString()} timed out ${targetUser.toString()} for ${timeDisplay} for reason: ${reason}`
            });
        }
    } catch (logError) {
        console.error('Failed to send log message:', logError);
    }
}

// Helper function to handle removing timeout
async function handleRemoveTimeout(interaction, targetMember, targetUser, reason) {
    // Check if the user is currently timed out
    if (!targetMember.communicationDisabledUntil) {
        await interaction.reply({
            content: `${targetUser.toString()} is not currently timed out.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Remove timeout
    await targetMember.timeout(null, `Timeout removed by ${interaction.user.tag}: ${reason}`);
    await interaction.reply({
        content: `✅ Timeout has been removed from ${targetUser.toString()}.\nReason: ${reason}`,
        flags: MessageFlags.Ephemeral
    });

    // Send notification to the log channel
    try {
        const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel) {
            await logChannel.send({
                content: `${interaction.user.toString()} removed timeout from ${targetUser.toString()} for reason: ${reason}`
            });
        }
    } catch (logError) {
        console.error('Failed to send log message:', logError);
    }
} 