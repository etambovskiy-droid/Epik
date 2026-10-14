/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StoryPriority = 'Must Have' | 'Should Have' | 'Could Have';
export type StoryStatus =
  | 'draft'
  | 'evaluated'
  | 'clarifying'
  | 'ready_to_compile'
  | 'compiling'
  | 'released';

export interface ClarifyingQuestion {
  id: string;
  question: string;
  importancePrompt: string; // "Чому це важливо і як це вплине на вашу роботу?"
  userAnswer?: string;
}

export interface StoryEvaluation {
  businessImpactScore: number; // 1-10
  implementationFeasibility: number; // 1-10
  priority: StoryPriority;
  riskLevel: 'Низький' | 'Середній' | 'Підвищений';
  summaryRationale: string;
}

export interface UserStoryProposal {
  id: string;
  title: string;
  userRole: string; // "Як селер маркетплейсу..."
  wantFeature: string; // "Я хочу..."
  soThatBenefit: string; // "Щоб отримати..."
  createdAt: string;
  status: StoryStatus;
  
  evaluation?: StoryEvaluation;
  clarifyingQuestions: ClarifyingQuestion[];
  compilationLogs?: string[];
  releasedVersion?: string;
  releasedAt?: string;
  isActiveFeature?: boolean;
}

export interface ReleaseLogItem {
  version: string;
  title: string;
  storyId: string;
  deployedAt: string;
  changesSummary: string[];
  featuresActivated: string[];
}
