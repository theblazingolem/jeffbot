const { SlashCommandBuilder, MessageFlags } = require("discord.js");

const LOG_CHANNEL_ID = "1424304322812051596";
const OVERRIDE_CODE = "7337#";

const forbiddenPatterns = [
    "porn",
    "hitler",
    /\b[gG](?:[oO0]{2,})[nN]\w*\b/i, // goon
    /\bn[i1]g{2,}(?:a|er)?s?\b/i, // n word
    /f[a@]g{1,2}[o0]ts?/i, // f word
    /r[e3]t[a@]rd/i,
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("echo")
        .setDescription("Repeats your message or replies to another message.")
        .addStringOption((option) =>
            option
                .setName("message")
                .setDescription("The message to send")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("reply_to")
                .setDescription(
                    "Message ID or link to reply to (requires override code)"
                )
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("override_code")
                .setDescription(
                    "Admin code to bypass certain filters or to reply."
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        const messageContent = interaction.options.getString("message");
        const overrideCodeInput =
            interaction.options.getString("override_code");
        const replyToInput = interaction.options.getString("reply_to");

        if (!messageContent.trim()) {
            return interaction.reply({
                content: "Cannot send an empty message!",
                flags: MessageFlags.Ephemeral,
            });
        }

        const hasOverride = overrideCodeInput === OVERRIDE_CODE;

        // --- Filtering Logic ---
        const alwaysForbiddenPatterns = [
            { pattern: /@everyone/, name: "@everyone mention" },
            { pattern: /@here/, name: "@here mention" },
            { pattern: /<@&\d+>/, name: "role mention" },
        ];

        for (const { pattern, name } of alwaysForbiddenPatterns) {
            if (pattern.test(messageContent)) {
                return interaction.reply({
                    content: `Your message contains a forbidden ${name}, which is not allowed under any circumstances.`,
                    flags: MessageFlags.Ephemeral,
                });
            }
        }

        if (!hasOverride) {
            // Check for user mentions
            if (/<@\d+>/.test(messageContent)) {
                return interaction.reply({
                    content: `Your message contains a user mention, which is not allowed.`,
                    flags: MessageFlags.Ephemeral,
                });
            }
            // Check for forbidden words/patterns
            if (hasForbiddenContent(messageContent, forbiddenPatterns)) {
                return interaction.reply({
                    content: `Your message contains a forbidden word or pattern, which is not allowed.`,
                    flags: MessageFlags.Ephemeral,
                });
            }
        }

        // --- Send the Message and Log ---
        try {
            let sentMessage;
            if (replyToInput) {
                // Logic for replying to a message
                if (!hasOverride) {
                    return interaction.reply({
                        content:
                            "You must provide the correct admin override code to use the reply feature.",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                const targetMessage = await parseReplyTarget(
                    interaction,
                    replyToInput
                );
                if (!targetMessage) {
                    return interaction.reply({
                        content:
                            "Could not find the message to reply to. Please check the ID or link.",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                sentMessage = await targetMessage.reply({
                    content: messageContent,
                    allowedMentions: { repliedUser: false }, // Does not ping the original author
                });
            } else {
                // Standard echo logic
                sentMessage = await interaction.channel.send(messageContent);
            }

            await interaction.reply({
                content: "Message sent!",
                flags: MessageFlags.Ephemeral,
            });
            await sendLogMessage(
                interaction,
                messageContent,
                sentMessage,
                !!replyToInput
            );
        } catch (error) {
            console.error("Error in echo command:", error);
            await interaction
                .reply({
                    content: "There was an error while sending the message!",
                    flags: MessageFlags.Ephemeral,
                })
                .catch(console.error);
        }
    },
};

/**
 * Parses a message ID or link to find a message object.
 * @param {import('discord.js').Interaction} interaction The interaction object.
 * @param {string} target The message ID or link.
 * @returns {Promise<import('discord.js').Message|null>} The message object or null if not found.
 */
async function parseReplyTarget(interaction, target) {
    const MESSAGE_LINK_REGEX =
        /^https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)$/;
    const MESSAGE_ID_REGEX = /^\d{17,20}$/;

    const linkMatch = target.match(MESSAGE_LINK_REGEX);
    if (linkMatch) {
        const [, guildId, channelId, messageId] = linkMatch;
        if (guildId !== interaction.guild.id) return null;
        try {
            const channel = await interaction.guild.channels.fetch(channelId);
            return await channel.messages.fetch(messageId);
        } catch {
            return null;
        }
    }

    if (MESSAGE_ID_REGEX.test(target)) {
        try {
            // Search all text-based channels in the guild
            for (const channel of interaction.guild.channels.cache.values()) {
                if (channel.isTextBased()) {
                    try {
                        const message = await channel.messages.fetch(target);
                        if (message) return message;
                    } catch {}
                }
            }
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Checks a message against a list of forbidden strings and RegEx patterns.
 * @param {string} message The message content to check.
 * @param {Array<string|RegExp>} patterns The list of patterns.
 * @returns {boolean} True if forbidden content is found, false otherwise.
 */
function hasForbiddenContent(message, patterns) {
    for (const item of patterns) {
        const regex =
            item instanceof RegExp
                ? item
                : new RegExp(
                      `\\b${item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
                      "i"
                  );
        if (regex.test(message)) return true;
    }
    return false;
}

/**
 * Sends a formatted log message to the log channel.
 * @param {import('discord.js').Interaction} interaction
 * @param {string} content
 * @param {import('discord.js').Message} sentMessage
 * @param {boolean} isReply
 */
async function sendLogMessage(
    interaction,
    content,
    sentMessage,
    isReply = false
) {
    try {
        const logChannel = await interaction.guild.channels.fetch(
            LOG_CHANNEL_ID
        );
        if (!logChannel || !logChannel.isTextBased()) {
            console.error(`Log channel with ID ${LOG_CHANNEL_ID} not found.`);
            return;
        }

        const actionText = isReply ? "replied with" : "sent a message in";
        const logMessage = [
            `**${
                interaction.user.tag
            }** ${actionText} ${interaction.channel.toString()}:`,
            `> ${content}`,
            `-# Jump to message: ${sentMessage.url}`,
        ].join("\n");

        await logChannel.send(logMessage);
    } catch (error) {
        console.error("Failed to send log message:", error);
    }
}
