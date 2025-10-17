const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("join")
        .setDescription("get an invite link to join the Jurassic World server"),

    async execute(interaction) {
        await interaction.reply({
            content:
                "Join the Jurassic World server: https://discord.gg/U2SqD5nxsT",
        });
    },
};
