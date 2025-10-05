const { SlashCommandBuilder, MessageFlags } = require("discord.js");

const LOG_CHANNEL_ID = "845885831708540940";

const OVERRIDE_CODE = "7337#";

const forbiddenWords = [
    "porn",
    /\b[gG](?:[oO0]{2,})[nN]\w*\b/, //goon
    /\bn[i1]g{2,}(?:a|er)?s?\b/i, //n word
    /f[a@]g{1,2}[o0]ts?/, // f word
    /r[e3]t[a@]rd/,
];
const badWordsRegex = new RegExp(`\\b(${forbiddenWords.join("|")})\\b`, "i");

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

        // --- 1. Initial Validation ---
        if (!messageContent.trim()) {
            return interaction.reply({
                content: "Cannot send an empty message!",
                flags: MessageFlags.Ephemeral,
            });
        }

        // --- 2. Check for Override Code ---
        const hasOverride = overrideCodeInput === OVERRIDE_CODE;

        // --- 3. Filtering Logic ---
        // These mentions are *always* forbidden
        const alwaysForbiddenPatterns = [
            { pattern: /@everyone/, name: "@everyone mention" },
            { pattern: /@here/, name: "@here mention" },
            { pattern: /<@&\d+>/, name: "role mention" }, // Matches <@&role_id>
        ];

        // These are forbidden *unless* the override code is used
        const conditionalForbiddenPatterns = [
            { pattern: /<@\d+>/, name: "user mention" }, // Matches <@user_id>
            { pattern: badWordsRegex, name: "forbidden word" },
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
            for (const { pattern, name } of conditionalForbiddenPatterns) {
                if (pattern.test(messageContent)) {
                    return interaction.reply({
                        content: `Your message contains a ${name}, which is not allowed. Admins can bypass some filters with an override code.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }
        }

        // --- 4. Send the Message and Log ---
        try {
            // Send the actual message to the channel
            const sentMessage = await interaction.channel.send(messageContent);

            // Send ephemeral confirmation to the user
            await interaction.reply({
                content: "Message sent!",
                flags: MessageFlags.Ephemeral,
            });

            // Send the log message to the designated channel
            await sendLogMessage(interaction, messageContent, sentMessage);
        } catch (error) {
            console.error("Error in echo command:", error);
            await interaction
                .reply({
                    content: "There was an error while sending the message!",
                    flags: MessageFlags.Ephemeral,
                })
                .catch(console.error); // In case the initial reply fails
        }
    },
};

/**
 * Sends a formatted log message to the log channel.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction The interaction object.
 * @param {string} content The original content of the message.
 * @param {import('discord.js').Message} sentMessage The message object returned after sending the echo.
 */
async function sendLogMessage(interaction, content, sentMessage) {
    try {
        const logChannel = await interaction.guild.channels.fetch(
            LOG_CHANNEL_ID
        );
        if (!logChannel || !logChannel.isTextBased()) {
            console.error(
                `Log channel with ID ${LOG_CHANNEL_ID} not found or is not a text channel.`
            );
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
