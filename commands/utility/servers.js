const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} = require("discord.js");
const GUILD_ID = "841699180271239218";
module.exports = {
    data: new SlashCommandBuilder()
        .setName("servers")
        .setDescription("Lists all servers the bot is in")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Restrict to administrators only

    guildCommand: true,
    guildId: GUILD_ID,
    async execute(interaction) {
        try {
            // Acknowledge the interaction immediately
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            // Get the client
            const client = interaction.client;

            // Get all guilds the client is in
            const guilds = client.guilds.cache;

            if (guilds.size === 0) {
                return interaction.editReply({
                    content: "I am not in any servers.",
                });
            }

            // Start building the response
            let responseContent = `# Servers I'm In (${guilds.size})\n\n`;

            // For each guild, try to create an invite
            const guildPromises = guilds.map(async (guild) => {
                let guildInfo = `## ${guild.name} (ID: ${guild.id})\n`;
                guildInfo += `Members: ${guild.memberCount}\n`;

                try {
                    // Check if the bot has permissions to create invites
                    const botMember = guild.members.cache.get(client.user.id);

                    if (
                        botMember.permissions.has(
                            PermissionFlagsBits.CreateInstantInvite
                        )
                    ) {
                        // Get the first text channel we can create an invite in
                        const channels = guild.channels.cache.filter(
                            (c) =>
                                c.type === 0 && // 0 is GUILD_TEXT
                                c
                                    .permissionsFor(client.user)
                                    .has(
                                        PermissionFlagsBits.CreateInstantInvite
                                    )
                        );

                        if (channels.size > 0) {
                            const channel = channels.first();
                            // Create an invite that doesn't expire
                            const invite = await channel.createInvite({
                                maxAge: 0,
                                maxUses: 0,
                                unique: true,
                                reason: `Invite created by ${interaction.user.tag} using /servers command`,
                            });

                            guildInfo += `Invite Link: ${invite.url}\n`;
                        } else {
                            guildInfo += `Invite Link: No suitable channel found\n`;
                        }
                    } else {
                        guildInfo += `Invite Link: Missing permissions\n`;
                    }
                } catch (error) {
                    console.error(
                        `Error creating invite for ${guild.name}:`,
                        error
                    );
                    guildInfo += `Invite Link: Failed to create (${error.message})\n`;
                }

                return guildInfo;
            });

            // Wait for all guild info to be gathered
            const guildInfos = await Promise.all(guildPromises);

            // Add each guild's info to the response
            responseContent += guildInfos.join("\n");

            // Split the response if it's too long
            if (responseContent.length > 2000) {
                // Split into chunks of 2000 characters or less
                const chunks = [];
                let currentChunk = "";

                for (const line of responseContent.split("\n")) {
                    if (currentChunk.length + line.length + 1 > 2000) {
                        chunks.push(currentChunk);
                        currentChunk = line;
                    } else {
                        currentChunk += (currentChunk ? "\n" : "") + line;
                    }
                }

                if (currentChunk) {
                    chunks.push(currentChunk);
                }

                // Send the first chunk as an edit to the original reply
                await interaction.editReply({
                    content: chunks[0],
                });

                // Send the rest as follow-ups
                for (let i = 1; i < chunks.length; i++) {
                    await interaction.followUp({
                        content: chunks[i],
                        flags: MessageFlags.Ephemeral,
                    });
                }
            } else {
                // Send the entire response
                await interaction.editReply({
                    content: responseContent,
                });
            }
        } catch (error) {
            console.error("Error in servers command:", error);
            try {
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: `Error: ${error.message}`,
                    });
                } else if (!interaction.replied) {
                    await interaction.reply({
                        content: `Error: ${error.message}`,
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    await interaction.followUp({
                        content: `Error: ${error.message}`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
            } catch (followUpError) {
                console.error("Error sending error message:", followUpError);
            }
        }
    },
};
