const { Events, ActivityType } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        // Define the status messages to rotate between
        const statusMessages = [
            {
                name: '/join',
                type: ActivityType.Playing
            },
            {
                name: '/ianquote',
                type: ActivityType.Playing
            }
        ];

        let currentIndex = 0;

        // Set initial status
        client.user.setActivity(statusMessages[currentIndex]);
        console.log(`Bot status set to: ${statusMessages[currentIndex].name}`);

        // Set up a status rotation every 5 minutes (300000 ms)
        setInterval(() => {
            // Switch to the next status
            currentIndex = (currentIndex + 1) % statusMessages.length;
            client.user.setActivity(statusMessages[currentIndex]);
        }, 120000); // 2 minutes

        console.log('Bot status rotation enabled');
    },
};
