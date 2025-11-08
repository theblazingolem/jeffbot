const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("invite")
        .setDescription("get a link to invite this bot to your server"),

    async execute(interaction) {
        // Create an invite button
        const inviteButton = new ButtonBuilder()
            .setLabel("Add Bot to Server")
            .setURL(
                "https://discord.com/oauth2/authorize?client_id=896752618095902740"
            )
            .setStyle(ButtonStyle.Link);

        // Add the button to an action row
        const row = new ActionRowBuilder().addComponents(inviteButton);

        await interaction.reply({
            content: "Click the button below to invite me to your server:",
            components: [row],
        });
    },
};
