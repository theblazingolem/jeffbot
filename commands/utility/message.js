const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');

// Guild ID for guild-specific command
const GUILD_ID = '841699180271239218';

// Log channel for moderation actions
const LOG_CHANNEL_ID = '1350108952041492561';

// Regex for message links
const MESSAGE_LINK_REGEX = /^https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)$/;
// Regex for message ID
const MESSAGE_ID_REGEX = /^\d{17,20}$/;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('message')
        .setDescription('Get information about a message by ID or link')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option.setName('target')
                .setDescription('Message ID or message link')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to perform on the message')
                .setRequired(true)
                .addChoices(
                    { name: 'Info', value: 'info' },
                    { name: 'Delete', value: 'delete' },
                    { name: 'Pin', value: 'pin' },
                    { name: 'Unpin', value: 'unpin' },
                    { name: 'Publish', value: 'publish' }
                )),

    // Guild-specific command
    guildCommand: true,
    guildId: GUILD_ID,

    async execute(interaction) {
        try {
            // Check if the user has permission to manage messages
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                await interaction.reply({
                    content: 'You need the Manage Messages permission to use this command.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Get command options
            const targetInput = interaction.options.getString('target');
            const action = interaction.options.getString('action') || 'info';

            // Defer the reply since fetching messages might take a moment
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            // Parse the message target
            const messageInfo = await parseMessageTarget(interaction, targetInput);
            if (!messageInfo) {
                await interaction.followUp({
                    content: 'Invalid message ID or link. Please provide a valid message ID or Discord message link.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Destructure the message info
            const { message, channelId } = messageInfo;

            // Handle different actions 
            switch (action) {
                case 'info':
                    await handleMessageInfo(interaction, message, channelId);
                    break;
                case 'delete':
                    await handleMessageDelete(interaction, message, channelId);
                    break;
                case 'pin':
                    await handleMessagePin(interaction, message, channelId, true);
                    break;
                case 'unpin':
                    await handleMessagePin(interaction, message, channelId, false);
                    break;
                case 'publish':
                    await handleMessagePublish(interaction, message, channelId);
                    break;
                default:
                    await interaction.followUp({
                        content: `Unknown action: ${action}`,
                        flags: MessageFlags.Ephemeral
                    });
            }
        } catch (error) {
            console.error('Error in message command:', error);

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

// Helper function to parse a message target (ID or link)
async function parseMessageTarget(interaction, target) {
    // Check if it's a message link
    const linkMatch = target.match(MESSAGE_LINK_REGEX);
    if (linkMatch) {
        const [, guildId, channelId, messageId] = linkMatch;

        // Verify that the guild ID matches
        if (guildId !== interaction.guild.id) {
            return null;
        }

        try {
            // Try to fetch the channel
            const channel = await interaction.guild.channels.fetch(channelId);
            if (!channel) {
                return null;
            }

            // Try to fetch the message
            const message = await channel.messages.fetch(messageId);
            if (!message) {
                return null;
            }

            return { message, channelId };
        } catch (error) {
            console.error('Error fetching message from link:', error);
            return null;
        }
    }

    // Check if it's a message ID
    if (MESSAGE_ID_REGEX.test(target)) {
        const messageId = target;

        // Try to find the message in the current channel
        try {
            const message = await interaction.channel.messages.fetch(messageId);
            if (!message) {
                return null;
            }

            return { message, channelId: interaction.channel.id };
        } catch (error) {
            console.error('Error fetching message by ID:', error);
            return null;
        }
    }

    // If neither a valid link nor ID, return null
    return null;
}

// Handler for message info action
async function handleMessageInfo(interaction, message, channelId) {
    // Format the message info
    const author = message.author;
    const createdAt = `<t:${Math.floor(message.createdTimestamp / 1000)}:F>`;
    const content = message.content || '(No content)';
    const hasAttachments = message.attachments.size > 0;
    const hasEmbeds = message.embeds.length > 0;
    const isPinned = message.pinned;

    // Create the info message
    let infoMessage = `**Message Information**\n\n`;
    infoMessage += `**Author:** ${author.toString()} (${author.tag})\n`;
    infoMessage += `**Channel:** <#${channelId}>\n`;
    infoMessage += `**Created:** ${createdAt}\n`;
    infoMessage += `**Message ID:** ${message.id}\n`;
    infoMessage += `**Pinned:** ${isPinned ? 'Yes' : 'No'}\n`;
    infoMessage += `**Attachments:** ${hasAttachments ? `Yes (${message.attachments.size})` : 'No'}\n`;
    infoMessage += `**Embeds:** ${hasEmbeds ? `Yes (${message.embeds.length})` : 'No'}\n\n`;
    infoMessage += `**Content:**\n${content.length > 1000 ? content.substring(0, 1000) + '... (truncated)' : content}`;

    // Send the info message
    await interaction.followUp({
        content: infoMessage,
        flags: MessageFlags.Ephemeral
    });

    // Log to the log channel
    try {
        const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel) {
            await logChannel.send({
                content: `${interaction.user.toString()} viewed info for a message from ${author.toString()} in <#${channelId}>`
            });
        }
    } catch (logError) {
        console.error('Failed to send log message:', logError);
    }
}

// Handler for message delete action
async function handleMessageDelete(interaction, message, channelId) {
    try {
        // Check if bot has permission to delete the message
        if (!message.deletable) {
            await interaction.followUp({
                content: 'I do not have permission to delete this message.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const author = message.author;
        const content = message.content || '(No content)';

        // Delete the message
        await message.delete();

        // Send success message
        await interaction.followUp({
            content: `✅ Message from ${author.toString()} has been deleted.`,
            flags: MessageFlags.Ephemeral
        });

        // Log to the log channel
        try {
            const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel) {
                // Create a log of the deleted message
                let logMessage = `${interaction.user.toString()} deleted a message from ${author.toString()} in <#${channelId}>\n\n`;
                logMessage += `**Original content:**\n${content.length > 1500 ? content.substring(0, 1500) + '... (truncated)' : content}`;

                await logChannel.send({ content: logMessage });
            }
        } catch (logError) {
            console.error('Failed to send log message:', logError);
        }
    } catch (error) {
        console.error('Error deleting message:', error);
        await interaction.followUp({
            content: `Error deleting message: ${error.message}`,
            flags: MessageFlags.Ephemeral
        });
    }
}

// Handler for message pin/unpin action
async function handleMessagePin(interaction, message, channelId, shouldPin) {
    try {
        // Check if bot has permission to manage the message
        if (!message.pinnable) {
            await interaction.followUp({
                content: 'I do not have permission to pin/unpin this message.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const author = message.author;

        // Pin or unpin the message
        if (shouldPin) {
            // Check if already pinned
            if (message.pinned) {
                await interaction.followUp({
                    content: 'This message is already pinned.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            await message.pin();
            await interaction.followUp({
                content: `✅ Message from ${author.toString()} has been pinned.`,
                flags: MessageFlags.Ephemeral
            });
        } else {
            // Check if already unpinned
            if (!message.pinned) {
                await interaction.followUp({
                    content: 'This message is not pinned.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            await message.unpin();
            await interaction.followUp({
                content: `✅ Message from ${author.toString()} has been unpinned.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Log to the log channel
        try {
            const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel) {
                const action = shouldPin ? 'pinned' : 'unpinned';
                await logChannel.send({
                    content: `${interaction.user.toString()} ${action} a message from ${author.toString()} in <#${channelId}>`
                });
            }
        } catch (logError) {
            console.error('Failed to send log message:', logError);
        }
    } catch (error) {
        console.error(`Error ${shouldPin ? 'pinning' : 'unpinning'} message:`, error);
        await interaction.followUp({
            content: `Error ${shouldPin ? 'pinning' : 'unpinning'} message: ${error.message}`,
            flags: MessageFlags.Ephemeral
        });
    }
}

// Handler for publishing messages in announcement channels
async function handleMessagePublish(interaction, message, channelId) {
    try {
        // Get the channel
        const channel = await interaction.guild.channels.fetch(channelId);

        // Check if the channel is an announcement channel
        if (channel.type !== ChannelType.GuildAnnouncement) {
            await interaction.followUp({
                content: 'This message is not in an announcement channel. Only messages in announcement channels can be published.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // Check if the message is already crossposted
        if (message.flags.has('Crossposted')) {
            await interaction.followUp({
                content: 'This message has already been published.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const author = message.author;

        // Publish the message
        await message.crosspost();

        // Send success message
        await interaction.followUp({
            content: `✅ Message from ${author.toString()} has been published to followers of the announcement channel.`,
            flags: MessageFlags.Ephemeral
        });

        // Log to the log channel
        try {
            const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel) {
                await logChannel.send({
                    content: `${interaction.user.toString()} published a message from ${author.toString()} in <#${channelId}>`
                });
            }
        } catch (logError) {
            console.error('Failed to send log message:', logError);
        }
    } catch (error) {
        console.error('Error publishing message:', error);
        await interaction.followUp({
            content: `Error publishing message: ${error.message}`,
            flags: MessageFlags.Ephemeral
        });
    }
} 