const { SlashCommandBuilder, MessageFlags } = require('discord.js');
// const { execute } = require('./ping');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('echo')
        .setDescription('repeats your message')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send')
                .setRequired(true)),
    async execute(interaction) {
        const message = interaction.options.getString('message');

        // Validate message is not empty
        if (!message.trim()) {
            await interaction.reply({
                content: 'Cannot send an empty message!',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // Check for mentions
        const mentionPatterns = [
            /@everyone/,
            /@here/,
            /<@&?\d+>/  // Matches both role mentions (<@&role_id>) and user mentions (<@user_id>)
        ];

        for (const pattern of mentionPatterns) {
            if (pattern.test(message)) {
                await interaction.reply({
                    content: 'Your message contains @everyone, @here, or role/user mentions. These are not allowed for security reasons.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
        }

        try {
            // Split the message into words
            const words = message.split(' ');

            // Malcolm-style fillers
            const fillers = ['uh', 'uhh', 'um', 'umm', 'well', 'ah', 'oh'];

            // Create a modified message in Malcolm style
            let malcolmMessage = '';

            // 30% chance to add filler at the beginning
            if (Math.random() < 0.3) {
                malcolmMessage = fillers[Math.floor(Math.random() * fillers.length)] + ', ';
            }

            // Process each word
            for (let i = 0; i < words.length; i++) {
                // Add the word
                malcolmMessage += words[i];

                // 25% chance to add a filler after a word (but not the last word)
                if (i < words.length - 1 && Math.random() < 0.25) {
                    malcolmMessage += ' ' + fillers[Math.floor(Math.random() * fillers.length)];
                }

                // Add space if not the last word
                if (i < words.length - 1) {
                    malcolmMessage += ' ';
                }
            }

            // Send the Malcolm-style message
            await interaction.channel.send(malcolmMessage);

            // Send ephemeral confirmation to the user
            await interaction.reply({
                content: 'Message sent!',
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Error in echo command:', error);
            await interaction.reply({
                content: 'There was an error while sending the message!',
                flags: MessageFlags.Ephemeral
            }).catch(console.error);
        }
    }
};