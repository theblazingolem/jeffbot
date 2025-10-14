const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    AttachmentBuilder,
} = require("discord.js");
const GUILD_ID = "841699180271239218";
module.exports = {
    data: new SlashCommandBuilder()
        .setName("transcript")
        .setDescription(
            "Fetches the last 200 messages and saves them to a text file."
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Only admins can use this
        .setDMPermission(false), // Cannot be used in DMs
    guildCommand: true,
    guildId: GUILD_ID,
    async execute(interaction) {
        try {
            // Defer the reply to let the user know the bot is working on it.
            // This is important for tasks that might take a few seconds.
            await interaction.deferReply(); // The reply will now be visible to everyone in the channel.

            const channel = interaction.channel;
            let transcript = "";
            let lastId;
            const messageBatches = [];

            // Fetch messages in chunks of 100 (Discord API limit)
            for (let i = 0; i < 2; i++) {
                const options = { limit: 100 };
                if (lastId) {
                    options.before = lastId;
                }
                const messages = await channel.messages.fetch(options);
                if (messages.size === 0) {
                    break; // Stop if there are no more messages
                }
                messageBatches.push(messages);
                lastId = messages.lastKey();
            }

            if (messageBatches.length === 0) {
                await interaction.editReply({
                    content:
                        "There are no messages in this channel to create a transcript from.",
                });
                return;
            }

            // Combine all fetched messages into a single array
            const allMessages = [].concat(
                ...messageBatches.map((batch) => Array.from(batch.values()))
            );

            // Reverse the array so that the oldest messages are first
            allMessages.reverse();

            // Format each message into the desired string format
            for (const message of allMessages) {
                // Ignore messages from bots to keep the log clean
                if (message.author.bot) continue;

                const timestamp = new Date(
                    message.createdTimestamp
                ).toLocaleString("en-US", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true,
                });
                const username = message.author.tag;
                const content = message.content || "[No message content]"; // Handle embeds or attachments with no text

                transcript += `${username}: ${content}\n`;

                // Include content of attachments if any
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

            // Create a buffer from the transcript string
            const buffer = Buffer.from(transcript, "utf-8");

            // Create an attachment from the buffer
            const attachment = new AttachmentBuilder(buffer, {
                name: `transcript-${channel.name}-${Date.now()}.txt`,
            });

            // Send the file to the user
            await interaction.editReply({
                content: `Here is the transcript for the last ${allMessages.length} messages in this channel.`,
                files: [attachment],
            });
        } catch (error) {
            console.error("Error creating transcript:", error);
            await interaction.editReply({
                content:
                    "There was an error while creating the transcript. Please check my permissions and try again.",
            });
        }
    },
};
