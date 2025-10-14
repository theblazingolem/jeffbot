const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");

// This is the Guild ID where the command will be registered.
const GUILD_ID = "841699180271239218";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("transcript")
        .setDescription(
            "Fetches a specified number of messages and saves them to a text file."
        )
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription(
                    "The user this transcript is for (e.g., the ticket creator)."
                )
                .setRequired(false)
        )
        .addIntegerOption((option) =>
            option
                .setName("count")
                .setDescription(
                    "The number of messages to fetch (1-1000). Defaults to 200."
                )
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(1000)
        )
        .setDMPermission(false), // Cannot be used in DMs

    // guildCommand and guildId ensure this command only appears in your specific server.
    guildCommand: true,
    guildId: GUILD_ID,

    async execute(interaction) {
        // Defer the reply to let the user know the bot is working on it.
        await interaction.deferReply();

        try {
            // Get the optional parameters
            const targetUser = interaction.options.getUser("user");
            const requestedCount =
                interaction.options.getInteger("count") || 200;

            const channel = interaction.channel;
            let transcript = "";
            const allMessages = [];
            let lastId;

            // Fetch messages in batches, filtering bots as we go, until we have enough user messages.
            while (allMessages.length < requestedCount) {
                const options = { limit: 100 }; // Fetch in full batches for efficiency
                if (lastId) {
                    options.before = lastId;
                }

                const messages = await channel.messages.fetch(options);
                if (messages.size === 0) {
                    break; // Stop if there are no more messages in the channel
                }

                // Add non-bot messages to our collection
                messages.forEach((msg) => {
                    if (
                        !msg.author.bot &&
                        allMessages.length < requestedCount
                    ) {
                        allMessages.push(msg);
                    }
                });

                lastId = messages.lastKey();
            }

            if (allMessages.length === 0) {
                await interaction.editReply({
                    content:
                        "There are no user messages in this channel to create a transcript from.",
                });
                return;
            }

            // Reverse the array at the end to get chronological order (oldest first)
            allMessages.reverse();

            // Format each message into the desired string format
            for (const message of allMessages) {
                // The bot check is already done, but we keep it as a safeguard
                if (message.author.bot) continue;

                const username = message.author.tag;
                const content = message.content || "[No message content]";

                transcript += `${username}: ${content}\n`;

                if (message.attachments.size > 0) {
                    message.attachments.forEach((attachment) => {
                        transcript += `[Attachment]: ${attachment.url}\n`;
                    });
                }
            }

            if (!transcript) {
                await interaction.editReply({
                    content:
                        "Could not generate a transcript. This might be because all recent messages were from bots.",
                });
                return;
            }

            const buffer = Buffer.from(transcript, "utf-8");
            const attachment = new AttachmentBuilder(buffer, {
                name: `transcript-${channel.name}-${Date.now()}.txt`,
            });

            // --- Build the final reply message ---
            let finalContent;
            if (targetUser) {
                finalContent = `Transcript for ticket created by ${targetUser.toString()}.\nHere is the log for the last **${
                    allMessages.length
                }** user messages.`;
            } else {
                finalContent = `Here is the transcript for the last **${allMessages.length}** user messages in this channel.`;
            }

            // Send the file and the final message to the user
            await interaction.editReply({
                content: finalContent,
                files: [attachment],
            });
        } catch (error) {
            console.error("Error creating transcript:", error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "An error occurred while creating the transcript.",
                    ephemeral: true,
                });
            } else {
                await interaction.editReply({
                    content:
                        "There was an error while creating the transcript. Please check my permissions and try again.",
                });
            }
        }
    },
};
