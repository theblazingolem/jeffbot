const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');

// Guild ID for guild-specific command
const GUILD_ID = '841699180271239218';

// Store active monitors for each channel
const activeMonitors = new Map();
// Store cooldown timestamps for each channel
const channelCooldowns = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('revive')
        .setDescription('pings the chat role with a topic to discuss')
        .addStringOption(option =>
            option.setName('topic')
                .setDescription('The topic to discuss')
                .setRequired(true)),

    // Guild-specific command
    guildCommand: true,
    guildId: GUILD_ID,

    async execute(interaction) {
        try {
            const channel = interaction.channel;
            const topic = interaction.options.getString('topic');
            const roleId = '858331630997340170';

            // Check for ping injection attempts
            const pingPatterns = [
                /@everyone/,
                /@here/,
                /<@&?\d+>/  // Matches both role mentions (<@&role_id>) and user mentions (<@user_id>)
            ];

            for (const pattern of pingPatterns) {
                if (pattern.test(topic)) {
                    await interaction.reply({
                        content: 'Please send the command again without any mentions (@everyone, @here, or role/user mentions).',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
            }

            // Restored cooldown check
            const cooldownTime = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
            const lastUsed = channelCooldowns.get(channel.id);
            if (lastUsed) {
                const timeLeft = cooldownTime - (Date.now() - lastUsed);
                if (timeLeft > 0) {
                    const cooldownEndTime = Math.floor((lastUsed + cooldownTime) / 1000);

                    await interaction.reply({
                        content: `This command is on cooldown until <t:${cooldownEndTime}:t>.`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
            }

            // Set cooldown timestamp
            channelCooldowns.set(channel.id, Date.now());

            // Use the working approach with direct role ping
            console.log('Sending message with direct role ping...');

            await interaction.reply({
                content: `<@&${roleId}> Let's discuss: ${topic}`,
                allowedMentions: {
                    roles: [roleId]
                }
            });

            console.log('Message sent with allowedMentions!');

        } catch (error) {
            console.error('Error in revive command:', error);
            await interaction.reply({
                content: 'There was an error sending the message. Please try again.',
                flags: MessageFlags.Ephemeral
            });
        }
    },
}; 