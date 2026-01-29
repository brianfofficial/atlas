/**
 * Trust Monitor Tests
 *
 * Tests for the V1 Rollout & Trust Regression monitoring system.
 * Covers signal threshold detection, freeze triggers, and regression recording.
 *
 * @module @atlas/gateway/__tests__/trust-monitor
 */

import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  TrustSignalType,
  TrustSignalLevel,
  TRUST_SIGNAL_THRESHOLDS,
  ImmediateHaltTrigger,
} from '../rollout/types.js';

describe('Trust Signal Thresholds', () => {
  describe('Signal 1: Briefing Generation Failures', () => {
    const thresholds = TRUST_SIGNAL_THRESHOLDS.briefing_generation_failure;

    it('should define correct thresholds', () => {
      assert.equal(thresholds.normal.max, 0.02); // <2%
      assert.equal(thresholds.warning.max, 0.05); // 2-5%
    });

    it('should classify 1% as normal', () => {
      const value = 0.01;
      assert.equal(value <= thresholds.normal.max, true);
    });

    it('should classify 3% as warning', () => {
      const value = 0.03;
      assert.equal(value > thresholds.normal.max && value <= thresholds.warning.max, true);
    });

    it('should classify 6% as stop', () => {
      const value = 0.06;
      assert.equal(value > thresholds.warning.max, true);
    });
  });

  describe('Signal 2: Retry Usage Patterns', () => {
    const thresholds = TRUST_SIGNAL_THRESHOLDS.retry_usage;

    it('should define correct thresholds', () => {
      assert.equal(thresholds.normal.max, 0.10); // <10%
      assert.equal(thresholds.warning.max, 0.20); // 10-20%
    });

    it('should classify 8% as normal', () => {
      const value = 0.08;
      assert.equal(value <= thresholds.normal.max, true);
    });

    it('should classify 15% as warning', () => {
      const value = 0.15;
      assert.equal(value > thresholds.normal.max && value <= thresholds.warning.max, true);
    });

    it('should classify 25% as stop', () => {
      const value = 0.25;
      assert.equal(value > thresholds.warning.max, true);
    });
  });

  describe('Signal 3: Partial Success Frequency', () => {
    const thresholds = TRUST_SIGNAL_THRESHOLDS.partial_success;

    it('should define correct thresholds', () => {
      assert.equal(thresholds.normal.max, 0.15); // <15%
      assert.equal(thresholds.warning.max, 0.30); // 15-30%
    });

    it('should classify 10% as normal', () => {
      const value = 0.10;
      assert.equal(value <= thresholds.normal.max, true);
    });

    it('should classify 25% as warning', () => {
      const value = 0.25;
      assert.equal(value > thresholds.normal.max && value <= thresholds.warning.max, true);
    });

    it('should classify 35% as stop', () => {
      const value = 0.35;
      assert.equal(value > thresholds.warning.max, true);
    });
  });

  describe('Signal 4: Dismissal Behavior', () => {
    const thresholds = TRUST_SIGNAL_THRESHOLDS.dismissal_behavior;

    it('should define correct thresholds', () => {
      assert.equal(thresholds.normal.max, 0.05); // <5%
      assert.equal(thresholds.warning.max, 0.15); // 5-15%
    });

    it('should classify 3% as normal', () => {
      const value = 0.03;
      assert.equal(value <= thresholds.normal.max, true);
    });

    it('should classify 10% as warning', () => {
      const value = 0.10;
      assert.equal(value > thresholds.normal.max && value <= thresholds.warning.max, true);
    });

    it('should classify 20% as stop', () => {
      const value = 0.20;
      assert.equal(value > thresholds.warning.max, true);
    });
  });

  describe('Signal 5: Manual Refresh Loops', () => {
    const thresholds = TRUST_SIGNAL_THRESHOLDS.manual_refresh_loop;

    it('should define correct thresholds', () => {
      assert.equal(thresholds.normal.max, 1); // 0-1
      assert.equal(thresholds.warning.max, 3); // 2-3
    });

    it('should classify 1 refresh as normal', () => {
      const value = 1;
      assert.equal(value <= thresholds.normal.max, true);
    });

    it('should classify 2-3 refreshes as warning', () => {
      const value = 2;
      assert.equal(value > thresholds.normal.max && value <= thresholds.warning.max, true);
    });

    it('should classify >3 refreshes in 60s as stop', () => {
      const value = 4;
      assert.equal(value > thresholds.warning.max, true);
    });
  });

  describe('Signal 6: Trust-Risk Alerts', () => {
    const thresholds = TRUST_SIGNAL_THRESHOLDS.trust_risk_alert;

    it('should define correct thresholds', () => {
      assert.equal(thresholds.normal.max, 0); // 0
      assert.equal(thresholds.warning.max, 2); // 1-2
    });

    it('should classify 0 alerts as normal', () => {
      const value = 0;
      assert.equal(value <= thresholds.normal.max, true);
    });

    it('should classify 1-2 alerts as warning', () => {
      const value = 1;
      assert.equal(value > thresholds.normal.max && value <= thresholds.warning.max, true);
    });

    it('should classify >2 alerts as stop', () => {
      const value = 3;
      assert.equal(value > thresholds.warning.max, true);
    });
  });
});

describe('Signal Level Evaluation', () => {
  function evaluateSignalLevel(type: TrustSignalType, value: number): TrustSignalLevel {
    const thresholds = TRUST_SIGNAL_THRESHOLDS[type];
    if (value <= thresholds.normal.max) return 'normal';
    if (value <= thresholds.warning.max) return 'warning';
    return 'stop';
  }

  it('should correctly evaluate briefing_generation_failure levels', () => {
    assert.equal(evaluateSignalLevel('briefing_generation_failure', 0.01), 'normal');
    assert.equal(evaluateSignalLevel('briefing_generation_failure', 0.03), 'warning');
    assert.equal(evaluateSignalLevel('briefing_generation_failure', 0.06), 'stop');
  });

  it('should correctly evaluate retry_usage levels', () => {
    assert.equal(evaluateSignalLevel('retry_usage', 0.05), 'normal');
    assert.equal(evaluateSignalLevel('retry_usage', 0.15), 'warning');
    assert.equal(evaluateSignalLevel('retry_usage', 0.25), 'stop');
  });

  it('should correctly evaluate partial_success levels', () => {
    assert.equal(evaluateSignalLevel('partial_success', 0.10), 'normal');
    assert.equal(evaluateSignalLevel('partial_success', 0.20), 'warning');
    assert.equal(evaluateSignalLevel('partial_success', 0.35), 'stop');
  });

  it('should correctly evaluate dismissal_behavior levels', () => {
    assert.equal(evaluateSignalLevel('dismissal_behavior', 0.03), 'normal');
    assert.equal(evaluateSignalLevel('dismissal_behavior', 0.10), 'warning');
    assert.equal(evaluateSignalLevel('dismissal_behavior', 0.20), 'stop');
  });

  it('should correctly evaluate manual_refresh_loop levels', () => {
    assert.equal(evaluateSignalLevel('manual_refresh_loop', 1), 'normal');
    assert.equal(evaluateSignalLevel('manual_refresh_loop', 2), 'warning');
    assert.equal(evaluateSignalLevel('manual_refresh_loop', 4), 'stop');
  });

  it('should correctly evaluate trust_risk_alert levels', () => {
    assert.equal(evaluateSignalLevel('trust_risk_alert', 0), 'normal');
    assert.equal(evaluateSignalLevel('trust_risk_alert', 1), 'warning');
    assert.equal(evaluateSignalLevel('trust_risk_alert', 3), 'stop');
  });
});

describe('Immediate Halt Triggers', () => {
  const haltTriggers: ImmediateHaltTrigger[] = [
    'user_data_mismatch',
    'user_error_confusion',
    'integration_reconnect_loop',
    'retry_button_spam',
    'user_trust_question',
    'memory_without_attribution',
    'cascade_prevention_failure',
  ];

  it('should define all required halt triggers', () => {
    assert.ok(haltTriggers.includes('user_data_mismatch'));
    assert.ok(haltTriggers.includes('user_error_confusion'));
    assert.ok(haltTriggers.includes('integration_reconnect_loop'));
    assert.ok(haltTriggers.includes('retry_button_spam'));
    assert.ok(haltTriggers.includes('user_trust_question'));
    assert.ok(haltTriggers.includes('memory_without_attribution'));
    assert.ok(haltTriggers.includes('cascade_prevention_failure'));
  });

  it('should have 7 halt trigger types', () => {
    assert.equal(haltTriggers.length, 7);
  });
});

describe('Rollout Phase Progression', () => {
  const ROLLOUT_PHASE_LIMITS: Record<number, number> = {
    0: 1, // Builder-only
    1: 5, // Trusted testers
    2: 15, // Extended pilot
    3: Infinity, // Open v1.0
  };

  const ROLLOUT_PHASE_CLEAN_DAYS: Record<number, number> = {
    0: 7, // 7 consecutive clean days
    1: 14, // 14 consecutive clean days
    2: 30, // 30 consecutive clean days
    3: Infinity, // No further progression
  };

  it('should enforce phase 0 user limit of 1', () => {
    assert.equal(ROLLOUT_PHASE_LIMITS[0], 1);
  });

  it('should enforce phase 1 user limit of 5', () => {
    assert.equal(ROLLOUT_PHASE_LIMITS[1], 5);
  });

  it('should enforce phase 2 user limit of 15', () => {
    assert.equal(ROLLOUT_PHASE_LIMITS[2], 15);
  });

  it('should allow unlimited users in phase 3', () => {
    assert.equal(ROLLOUT_PHASE_LIMITS[3], Infinity);
  });

  it('should require 7 clean days to advance from phase 0', () => {
    assert.equal(ROLLOUT_PHASE_CLEAN_DAYS[0], 7);
  });

  it('should require 14 clean days to advance from phase 1', () => {
    assert.equal(ROLLOUT_PHASE_CLEAN_DAYS[1], 14);
  });

  it('should require 30 clean days to advance from phase 2', () => {
    assert.equal(ROLLOUT_PHASE_CLEAN_DAYS[2], 30);
  });
});

describe('User Eligibility Validation', () => {
  interface UserEligibilityTraits {
    technicalComfort: boolean;
    healthySkepticism: boolean;
    directChannel: boolean;
    patience: boolean;
    dailyToolUser: boolean;
  }

  interface UserAntiTargetFlags {
    expectsPolish: boolean;
    ignoresErrors: boolean;
    tooManyIntegrations: boolean;
    nonUSTimezone: boolean;
    needsAtlasToWork: boolean;
  }

  function isEligible(traits: UserEligibilityTraits, antiTargets: UserAntiTargetFlags): boolean {
    // All traits must be true
    const allTraitsMet = Object.values(traits).every(Boolean);
    // No anti-targets can be true
    const noAntiTargets = !Object.values(antiTargets).some(Boolean);
    return allTraitsMet && noAntiTargets;
  }

  it('should approve user with all traits and no anti-targets', () => {
    const traits: UserEligibilityTraits = {
      technicalComfort: true,
      healthySkepticism: true,
      directChannel: true,
      patience: true,
      dailyToolUser: true,
    };
    const antiTargets: UserAntiTargetFlags = {
      expectsPolish: false,
      ignoresErrors: false,
      tooManyIntegrations: false,
      nonUSTimezone: false,
      needsAtlasToWork: false,
    };
    assert.equal(isEligible(traits, antiTargets), true);
  });

  it('should reject user missing technical comfort', () => {
    const traits: UserEligibilityTraits = {
      technicalComfort: false,
      healthySkepticism: true,
      directChannel: true,
      patience: true,
      dailyToolUser: true,
    };
    const antiTargets: UserAntiTargetFlags = {
      expectsPolish: false,
      ignoresErrors: false,
      tooManyIntegrations: false,
      nonUSTimezone: false,
      needsAtlasToWork: false,
    };
    assert.equal(isEligible(traits, antiTargets), false);
  });

  it('should reject user who expects polish', () => {
    const traits: UserEligibilityTraits = {
      technicalComfort: true,
      healthySkepticism: true,
      directChannel: true,
      patience: true,
      dailyToolUser: true,
    };
    const antiTargets: UserAntiTargetFlags = {
      expectsPolish: true,
      ignoresErrors: false,
      tooManyIntegrations: false,
      nonUSTimezone: false,
      needsAtlasToWork: false,
    };
    assert.equal(isEligible(traits, antiTargets), false);
  });

  it('should reject user with too many integrations', () => {
    const traits: UserEligibilityTraits = {
      technicalComfort: true,
      healthySkepticism: true,
      directChannel: true,
      patience: true,
      dailyToolUser: true,
    };
    const antiTargets: UserAntiTargetFlags = {
      expectsPolish: false,
      ignoresErrors: false,
      tooManyIntegrations: true,
      nonUSTimezone: false,
      needsAtlasToWork: false,
    };
    assert.equal(isEligible(traits, antiTargets), false);
  });

  it('should reject user in non-US timezone (initially)', () => {
    const traits: UserEligibilityTraits = {
      technicalComfort: true,
      healthySkepticism: true,
      directChannel: true,
      patience: true,
      dailyToolUser: true,
    };
    const antiTargets: UserAntiTargetFlags = {
      expectsPolish: false,
      ignoresErrors: false,
      tooManyIntegrations: false,
      nonUSTimezone: true,
      needsAtlasToWork: false,
    };
    assert.equal(isEligible(traits, antiTargets), false);
  });
});

describe('Expansion Gate Criteria', () => {
  interface ExpansionCriteria {
    stabilityDays: number;
    requiredStabilityDays: number;
    trustRiskAlerts: number;
    feelsWrongReports: number;
    retryRate: number;
    partialSuccessRate: number;
  }

  function canExpand(criteria: ExpansionCriteria): boolean {
    return (
      criteria.stabilityDays >= criteria.requiredStabilityDays &&
      criteria.trustRiskAlerts === 0 &&
      criteria.feelsWrongReports === 0 &&
      criteria.retryRate < 0.08 &&
      criteria.partialSuccessRate < 0.10
    );
  }

  it('should allow expansion when all criteria met', () => {
    const criteria: ExpansionCriteria = {
      stabilityDays: 30,
      requiredStabilityDays: 30,
      trustRiskAlerts: 0,
      feelsWrongReports: 0,
      retryRate: 0.05,
      partialSuccessRate: 0.08,
    };
    assert.equal(canExpand(criteria), true);
  });

  it('should block expansion with insufficient stability days', () => {
    const criteria: ExpansionCriteria = {
      stabilityDays: 25,
      requiredStabilityDays: 30,
      trustRiskAlerts: 0,
      feelsWrongReports: 0,
      retryRate: 0.05,
      partialSuccessRate: 0.08,
    };
    assert.equal(canExpand(criteria), false);
  });

  it('should block expansion with any trust-risk alerts', () => {
    const criteria: ExpansionCriteria = {
      stabilityDays: 30,
      requiredStabilityDays: 30,
      trustRiskAlerts: 1,
      feelsWrongReports: 0,
      retryRate: 0.05,
      partialSuccessRate: 0.08,
    };
    assert.equal(canExpand(criteria), false);
  });

  it('should block expansion with any feels-wrong reports', () => {
    const criteria: ExpansionCriteria = {
      stabilityDays: 30,
      requiredStabilityDays: 30,
      trustRiskAlerts: 0,
      feelsWrongReports: 1,
      retryRate: 0.05,
      partialSuccessRate: 0.08,
    };
    assert.equal(canExpand(criteria), false);
  });

  it('should block expansion with retry rate >= 8%', () => {
    const criteria: ExpansionCriteria = {
      stabilityDays: 30,
      requiredStabilityDays: 30,
      trustRiskAlerts: 0,
      feelsWrongReports: 0,
      retryRate: 0.08,
      partialSuccessRate: 0.08,
    };
    assert.equal(canExpand(criteria), false);
  });

  it('should block expansion with partial success rate >= 10%', () => {
    const criteria: ExpansionCriteria = {
      stabilityDays: 30,
      requiredStabilityDays: 30,
      trustRiskAlerts: 0,
      feelsWrongReports: 0,
      retryRate: 0.05,
      partialSuccessRate: 0.10,
    };
    assert.equal(canExpand(criteria), false);
  });
});

describe('Decision Rule Validation', () => {
  interface ChangeProposal {
    description: string;
    improvesCapability: boolean;
    weakensPredictability: boolean;
  }

  function shouldShip(proposal: ChangeProposal): 'ship' | 'no_ship' | 'evaluate' {
    // Rule: "If this change improves capability but weakens predictability, we do not ship it."
    if (proposal.improvesCapability && proposal.weakensPredictability) {
      return 'no_ship';
    }
    if (!proposal.improvesCapability && !proposal.weakensPredictability) {
      return 'ship';
    }
    return 'evaluate';
  }

  it('should NOT ship AI-generated task prioritization', () => {
    const proposal: ChangeProposal = {
      description: 'Add AI-generated task prioritization',
      improvesCapability: true,
      weakensPredictability: true, // User can't predict ranking
    };
    assert.equal(shouldShip(proposal), 'no_ship');
  });

  it('should ship last sync timestamp', () => {
    const proposal: ChangeProposal = {
      description: 'Add "last sync" timestamp to each section',
      improvesCapability: false,
      weakensPredictability: false,
    };
    assert.equal(shouldShip(proposal), 'ship');
  });

  it('should NOT ship auto-dismiss learned preferences', () => {
    const proposal: ChangeProposal = {
      description: 'Auto-dismiss items user usually dismisses',
      improvesCapability: true,
      weakensPredictability: true, // ATLAS is "learning"
    };
    assert.equal(shouldShip(proposal), 'no_ship');
  });

  it('should ship retry button on partial success banner', () => {
    const proposal: ChangeProposal = {
      description: 'Add retry button to partial success banner',
      improvesCapability: false,
      weakensPredictability: false,
    };
    assert.equal(shouldShip(proposal), 'ship');
  });
});

describe('Feels Wrong Protocol', () => {
  const FEELS_WRONG_PROTOCOL = [
    "Do not explain - the user's feeling is valid",
    'Freeze new user invites immediately',
    'Reproduce the exact scenario within 2 hours',
    'If reproducible, fix before resuming',
    'If not reproducible, add logging to detect next time',
  ];

  it('should have 5 protocol steps', () => {
    assert.equal(FEELS_WRONG_PROTOCOL.length, 5);
  });

  it('should not explain as first step', () => {
    assert.ok(FEELS_WRONG_PROTOCOL[0]!.includes('Do not explain'));
  });

  it('should freeze immediately as second step', () => {
    assert.ok(FEELS_WRONG_PROTOCOL[1]!.includes('Freeze'));
  });

  it('should reproduce within 2 hours as third step', () => {
    assert.ok(FEELS_WRONG_PROTOCOL[2]!.includes('2 hours'));
  });
});
