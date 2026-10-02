import { BusinessRuleError } from '../../common/http/errors.js';

/** A document the participant must (or may) provide for a product (Appendix 3). */
export interface RequiredDocument {
  docType: string;
  label: string;
  mandatory: boolean;
}

/** A declaration question; a "yes" answer can require underwriting referral. */
export interface QuestionDefinition {
  code: string;
  text: string;
  referIfYes: boolean;
}

export interface QuestionnaireAnswer {
  code: string;
  answer: boolean;
  details?: string;
}

export function readRequiredDocuments(raw: unknown): RequiredDocument[] {
  if (!Array.isArray(raw)) {
    throw new Error('requiredDocuments must be an array');
  }
  return raw.map((item, index) => {
    const doc = item as Partial<RequiredDocument>;
    if (!doc.docType || !/^[A-Z0-9_]{2,50}$/.test(doc.docType) || !doc.label) {
      throw new Error(`requiredDocuments[${index}] needs docType and label`);
    }
    return { docType: doc.docType, label: doc.label, mandatory: doc.mandatory !== false };
  });
}

export function readQuestionnaire(raw: unknown): QuestionDefinition[] {
  if (!Array.isArray(raw)) {
    throw new Error('questionnaire must be an array');
  }
  return raw.map((item, index) => {
    const question = item as Partial<QuestionDefinition>;
    if (!question.code || !question.text) {
      throw new Error(`questionnaire[${index}] needs code and text`);
    }
    return { code: question.code, text: question.text, referIfYes: question.referIfYes === true };
  });
}

/**
 * Checks that every question is answered once; returns the referral reasons triggered
 * by "yes" answers. Details are mandatory when the answer is "yes".
 */
export function evaluateQuestionnaire(
  questions: QuestionDefinition[],
  answers: QuestionnaireAnswer[],
): string[] {
  const problems: string[] = [];
  const referrals: string[] = [];
  for (const question of questions) {
    const answer = answers.find((candidate) => candidate.code === question.code);
    if (!answer) {
      problems.push(`Please answer: ${question.text}`);
      continue;
    }
    if (answer.answer && !answer.details?.trim()) {
      problems.push(`Please give details for: ${question.text}`);
    }
    if (answer.answer && question.referIfYes) {
      referrals.push(`Declaration "${question.text}" answered yes – underwriting review`);
    }
  }
  const unknown = answers.filter(
    (answer) => !questions.some((question) => question.code === answer.code),
  );
  if (unknown.length > 0) {
    problems.push('The questionnaire contains unknown questions');
  }
  if (problems.length > 0) {
    throw new BusinessRuleError(
      'QUESTIONNAIRE_INCOMPLETE',
      'The questionnaire is incomplete',
      problems,
    );
  }
  return referrals;
}
