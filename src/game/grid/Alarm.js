import { MapEntity } from './MapEntity.js';

/**
 * Alarm - Alarm trigger entity (stub for future implementation)
 * 
 * Planned features:
 * - Can be triggered by detection, failed skill checks, or manual trigger
 * - Escalates ThreatClock when activated
 * - Can be disabled via security panel before triggered
 * - Some alarms are silent (call guards) vs loud (full escalation)
 */
export class Alarm extends MapEntity {
    constructor(config) {
        super({
            id: config.id || `alarm_${Date.now()}`,
            gridX: config.gridX,
            gridY: config.gridY,
            icon: '🔔',
            color: '#ffa726',
            layer: 'entity',
            label: config.label || 'Alarm',
            hitRadius: 10
        });

        // Alarm-specific properties
        this.alarmType = config.alarmType || 'LOUD';  // 'LOUD', 'SILENT', 'MOTION'
        this.triggerRadius = config.triggerRadius || 0;  // 0 = manual only, >0 = proximity trigger
        this.heatPenalty = config.heatPenalty || 10;
        this.threatPenalty = config.threatPenalty || 15;  // Seconds added to ThreatClock

        // State
        this.isDisabled = false;
        this.isTriggered = false;
    }

    /**
     * Trigger the alarm
     */
    trigger(source = 'unknown') {
        if (this.isDisabled || this.isTriggered) return false;

        this.isTriggered = true;
        this.icon = '🚨';
        this.color = '#ff0000';

        console.log(`[Alarm] ${this.id} TRIGGERED by ${source}!`);

        // TODO: Apply heat penalty
        // TODO: Escalate ThreatClock
        // TODO: Dispatch event for UI/audio

        window.dispatchEvent(new CustomEvent('alarmTriggered', {
            detail: {
                alarmId: this.id,
                alarmType: this.alarmType,
                source
            }
        }));

        return true;
    }

    /**
     * Disable the alarm (via security panel)
     */
    disable() {
        if (this.isTriggered) {
            console.log(`[Alarm] ${this.id} already triggered, cannot disable`);
            return false;
        }

        this.isDisabled = true;
        this.icon = '🔕';
        this.color = '#666666';
        console.log(`[Alarm] ${this.id} disabled`);
        return true;
    }

    /**
     * Check if entity triggers proximity alarm (stub)
     */
    checkProximity(entityX, entityY) {
        if (this.isDisabled || this.isTriggered || this.triggerRadius <= 0) {
            return false;
        }

        const dist = Math.hypot(entityX - this.gridX, entityY - this.gridY);
        if (dist <= this.triggerRadius) {
            this.trigger('proximity');
            return true;
        }
        return false;
    }

    /**
     * Render alarm indicator
     */
    render(ctx, camera) {
        // Pulsing effect when triggered
        if (this.isTriggered) {
            const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 150);
            this.color = `rgba(255, 0, 0, ${0.5 + pulse * 0.5})`;
        }

        super.render(ctx, camera);
    }
}
