const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

// Guild ID for guild-specific command
const GUILD_ID = '841699180271239218';
// The role to toggle
const TARGET_ROLE_ID = '1396464270077591583';
// Channels to exclude from global mute
const EXCLUDED_CHANNELS = [
    '842747868960129025',
    '1036666039452311592',
    '915890444922155008'
];
// Category IDs to target for global mute
const TARGET_CATEGORIES = [
    '1260957720731979857',
    '842746033213669388'
];
// Duration options in ms
const DURATION_OPTIONS = {
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000
};
// In-memory map to track timeouts: { channelId: timeoutObject }
const muteTimeouts = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('watchlist')
        .setDescription('Manage the watchlist role and mute in this channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('mute')
                .setDescription('Mute or unmute the watchlist role in this channel or globally')
                .addStringOption(opt =>
                    opt.setName('duration')
                        .setDescription('How long to mute the role for')
                        .setRequired(true)
                        .addChoices(
                            { name: '15 minutes', value: '15m' },
                            { name: '30 minutes', value: '30m' },
                            { name: '1 hour', value: '1h' }
                        )
                )
                .addBooleanOption(opt =>
                    opt.setName('global')
                        .setDescription('Mute in all channels except excluded ones')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add the watchlist role to a user')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('User to add to the watchlist')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove the watchlist role from a user')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('User to remove from the watchlist')
                        .setRequired(true)
                )
        ),

    guildCommand: true,
    guildId: GUILD_ID,

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            // Allow only administrators or users with the moderator role
            const MOD_ROLE_ID = '857990235194261514';
            const member = interaction.member;
            if (!member.permissions.has(PermissionFlagsBits.Administrator) && !member.roles.cache.has(MOD_ROLE_ID)) {
                await interaction.editReply({
                    content: 'You do not have permission to use this command.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const subcommand = interaction.options.getSubcommand();
            const guild = interaction.guild;
            const role = await guild.roles.fetch(TARGET_ROLE_ID);
            if (!role) {
                await interaction.editReply({
                    content: `Role <@&${TARGET_ROLE_ID}> not found!`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (subcommand === 'mute') {
                const global = interaction.options.getBoolean('global') || false;
                const durationKey = interaction.options.getString('duration');
                const durationMs = DURATION_OPTIONS[durationKey];
                if (!durationMs) {
                    await interaction.editReply({
                        content: 'Invalid duration selected.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                if (global) {
                    // Mute or unmute only channels under the target categories, except excluded
                    let mutedChannels = [];
                    let unmutedChannels = [];
                    for (const [id, channel] of guild.channels.cache) {
                        if (EXCLUDED_CHANNELS.includes(id)) continue;
                        if (!channel.isTextBased?.() || !channel.viewable) continue;
                        if (!channel.parentId || !TARGET_CATEGORIES.includes(channel.parentId)) continue;
                        const overwrite = channel.permissionOverwrites.cache.get(TARGET_ROLE_ID);
                        if (!overwrite || overwrite.allow.has(PermissionFlagsBits.SendMessages) || (!overwrite.deny.has(PermissionFlagsBits.SendMessages))) {
                            // Not muted, so mute
                            await channel.permissionOverwrites.edit(role, {
                                SendMessages: false
                            });
                            mutedChannels.push(channel);
                            // Set timeout to unmute
                            if (muteTimeouts.has(channel.id)) clearTimeout(muteTimeouts.get(channel.id));
                            muteTimeouts.set(channel.id, setTimeout(async () => {
                                try {
                                    await channel.permissionOverwrites.edit(role, { SendMessages: null });
                                } catch (e) { console.error('Failed to auto-unmute:', e); }
                                muteTimeouts.delete(channel.id);
                            }, durationMs));
                        } else {
                            // Already muted, so unmute (reset to default)
                            await channel.permissionOverwrites.edit(role, {
                                SendMessages: null
                            });
                            unmutedChannels.push(channel);
                            if (muteTimeouts.has(channel.id)) {
                                clearTimeout(muteTimeouts.get(channel.id));
                                muteTimeouts.delete(channel.id);
                            }
                        }
                    }
                    let msg = '';
                    if (mutedChannels.length > 0) msg += `Muted <@&${TARGET_ROLE_ID}> in ${mutedChannels.length} channels for ${durationKey}.\n`;
                    if (unmutedChannels.length > 0) msg += `Unmuted <@&${TARGET_ROLE_ID}> in ${unmutedChannels.length} channels.\n`;
                    if (!msg) msg = 'No channels were changed.';
                    await interaction.editReply({
                        content: msg,
                        flags: MessageFlags.Ephemeral
                    });
                } else {
                    // Mute or unmute in the current channel
                    const channel = interaction.channel;
                    const overwrite = channel.permissionOverwrites.cache.get(TARGET_ROLE_ID);
                    if (!overwrite || overwrite.allow.has(PermissionFlagsBits.SendMessages) || (!overwrite.deny.has(PermissionFlagsBits.SendMessages))) {
                        // Not muted, so mute
                        await channel.permissionOverwrites.edit(role, {
                            SendMessages: false
                        });
                        // Set timeout to unmute
                        if (muteTimeouts.has(channel.id)) clearTimeout(muteTimeouts.get(channel.id));
                        muteTimeouts.set(channel.id, setTimeout(async () => {
                            try {
                                await channel.permissionOverwrites.edit(role, { SendMessages: null });
                            } catch (e) { console.error('Failed to auto-unmute:', e); }
                            muteTimeouts.delete(channel.id);
                        }, durationMs));
                        await interaction.editReply({
                            content: `<@&${TARGET_ROLE_ID}> has been muted (cannot send messages) in <#${channel.id}> for ${durationKey}`,
                            flags: MessageFlags.Ephemeral
                        });
                    } else {
                        // Already muted, so unmute (reset to default)
                        await channel.permissionOverwrites.edit(role, {
                            SendMessages: null
                        });
                        if (muteTimeouts.has(channel.id)) {
                            clearTimeout(muteTimeouts.get(channel.id));
                            muteTimeouts.delete(channel.id);
                        }
                        await interaction.editReply({
                            content: `<@&${TARGET_ROLE_ID}> has been unmuted (send messages permission reset to default) in <#${channel.id}>`,
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }
            } else if (subcommand === 'add') {
                // Add the role to a user
                const user = interaction.options.getUser('user');
                const guildMember = await guild.members.fetch(user.id);
                if (!guildMember) {
                    await interaction.editReply({
                        content: `User not found in this server!`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                if (guildMember.roles.cache.has(TARGET_ROLE_ID)) {
                    await interaction.editReply({
                        content: `${user} already has the watchlist role.`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                await guildMember.roles.add(role);
                await interaction.editReply({
                    content: `Added <@&${TARGET_ROLE_ID}> to ${user}.`,
                    flags: MessageFlags.Ephemeral
                });
            } else if (subcommand === 'remove') {
                // Remove the role from a user
                const user = interaction.options.getUser('user');
                const guildMember = await guild.members.fetch(user.id);
                if (!guildMember) {
                    await interaction.editReply({
                        content: `User not found in this server!`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                if (!guildMember.roles.cache.has(TARGET_ROLE_ID)) {
                    await interaction.editReply({
                        content: `${user} does not have the watchlist role.`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                await guildMember.roles.remove(role);
                await interaction.editReply({
                    content: `Removed <@&${TARGET_ROLE_ID}> from ${user}.`,
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await interaction.editReply({
                    content: 'Unknown subcommand.',
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch (error) {
            console.error('Error in watchlist command:', error);
            try {
                await interaction.editReply({
                    content: `An error occurred: ${error.message}`,
                    flags: MessageFlags.Ephemeral
                });
            } catch (err) {
                console.error('Failed to send error reply:', err);
            }
        }
    }
}; 