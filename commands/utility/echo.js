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
        .setDescription("Repeats your message")
        .addStringOption((option) =>
            option
                .setName("message")
                .setDescription("The message to send")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("override_code")
                .setDescription("Admin code to bypass certain filters.")
                .setRequired(false)
        ),

    async execute(interaction) {
        const messageContent = interaction.options.getString("message");
        const overrideCodeInput =
            interaction.options.getString("override_code");

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
            const sentMessage = await interaction.channel.send(messageContent);
            await interaction.reply({
                content: "Message sent!",
                flags: MessageFlags.Ephemeral,
            });
            await sendLogMessage(interaction, messageContent, sentMessage);
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
 * Checks a message against a list of forbidden strings and RegEx patterns.
 * @param {string} message The message content to check.
 * @param {Array<string|RegExp>} patterns The list of patterns.
 * @returns {boolean} True if forbidden content is found, false otherwise.
 */
function hasForbiddenContent(message, patterns) {
    for (const item of patterns) {
        const regex =
            item instanceof RegExp
                ? // If it's already a RegExp, use it
                  item
                : // If it's a string, convert it to a whole-word, case-insensitive RegExp
                  new RegExp(
                      `\\b${item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
                      "i"
                  );

        if (regex.test(message)) {
            return true; // Found a match
        }
    }
    return false; // No matches found
}

/**
 * Sends a formatted log message to the log channel.
 */
async function sendLogMessage(interaction, content, sentMessage) {
    try {
        const logChannel = await interaction.guild.channels.fetch(
            LOG_CHANNEL_ID
        );
        if (!logChannel || !logChannel.isTextBased()) {
            console.error(`Log channel with ID ${LOG_CHANNEL_ID} not found.`);
            return;
        }

        const logMessage = [
            `**${
                interaction.user.username
            }** sent a message in ${interaction.channel.toString()}:`,
            `> ${content}`,
            `-# Jump to message: ${sentMessage.url}`,
        ].join("\n");

        await logChannel.send(logMessage);
    } catch (error) {
        console.error("Failed to send log message:", error);
    }
}
