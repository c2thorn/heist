export class CrewGenerator {
    static generateHire(difficulty) {
        const roles = ['Hacker', 'Muscle', 'Infiltrator', 'Face'];
        const role = roles[Math.floor(Math.random() * roles.length)];
        const name = this.getRandomName();

        // Base Stats
        const stats = {
            force: Math.floor(Math.random() * 4) + 1,
            tech: Math.floor(Math.random() * 4) + 1,
            stealth: Math.floor(Math.random() * 4) + 1,
            face: Math.floor(Math.random() * 4) + 1
        };

        // Boost Primary Stat
        switch (role) {
            case 'Hacker': stats.tech += 4; break;
            case 'Muscle': stats.force += 4; break;
            case 'Infiltrator': stats.stealth += 4; break;
            case 'Face': stats.face += 4; break;
        }

        // Calculate Wage costs
        const totalStats = Object.values(stats).reduce((a, b) => a + b, 0);
        const wage = Math.floor(totalStats * 50 * (1 + (difficulty * 0.1)));

        return {
            id: 'hire_' + Math.random().toString(36).substr(2, 9),
            name: name,
            role: role,
            stats: stats,
            wage: wage,
            status: 'AVAILABLE'
        };
    }

    static getRandomName() {
        const first = ["Jack", "Sarah", "Cole", "Mara", "Finn", "Tess", "Leo", "Kira"];
        const last = ["Savage", "Vane", "Sterling", "Kross", "Black", "Steel", "Sharp", "Winter"];
        return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`;
    }
}
