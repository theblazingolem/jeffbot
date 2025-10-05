const { SlashCommandBuilder } = require("discord.js");
const { quotes } = require("../../data/quotes.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ianquote")
        .setDescription("replies with an Ian Malcolm quote."),
    async execute(interaction) {
        const randomIndex = Math.floor(Math.random() * quotes.length);
        const randomQuote = quotes[randomIndex];

        await interaction.reply(randomQuote);
    },
};
