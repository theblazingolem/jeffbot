const { SlashCommandBuilder } = require('discord.js');
const { quotes } = require('../../data/quotes.js'); // Adjust path as needed

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ianquote')
        .setDescription('replies with an Ian Malcolm quote.'),
    async execute(interaction) {
        // Get a random index based on the quotes array length
        const randomIndex = Math.floor(Math.random() * quotes.length);
        // Select the quote using the random index
        const randomQuote = quotes[randomIndex];

        // Reply with the randomly selected quote
        await interaction.reply('>>> ' + randomQuote);
    },
}; 