import {
  evaluateQuestionnaire,
  type QuestionDefinition,
  readRequiredDocuments,
} from './product-definitions.js';

const questions: QuestionDefinition[] = [
  { code: 'Q1', text: 'Currently ill?', referIfYes: true },
  { code: 'Q2', text: 'Smoker?', referIfYes: false },
];

describe('product definitions', () => {
  it('returns referral reasons for "yes" answers that require underwriting', () => {
    const referrals = evaluateQuestionnaire(questions, [
      { code: 'Q1', answer: true, details: 'Asthma' },
      { code: 'Q2', answer: true, details: '5 a day' },
    ]);
    expect(referrals).toEqual(['Declaration "Currently ill?" answered yes – underwriting review']);
  });

  it('requires every question to be answered and details for "yes"', () => {
    expect(() => evaluateQuestionnaire(questions, [{ code: 'Q1', answer: true }])).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          code: 'QUESTIONNAIRE_INCOMPLETE',
          details: ['Please give details for: Currently ill?', 'Please answer: Smoker?'],
        }),
      }),
    );
  });

  it('rejects answers to questions the product does not ask', () => {
    expect(() =>
      evaluateQuestionnaire(questions, [
        { code: 'Q1', answer: false },
        { code: 'Q2', answer: false },
        { code: 'Q9', answer: false },
      ]),
    ).toThrow();
  });

  it('treats documents as mandatory unless stated otherwise', () => {
    expect(readRequiredDocuments([{ docType: 'IC_COPY', label: 'IC copy' }])).toEqual([
      { docType: 'IC_COPY', label: 'IC copy', mandatory: true },
    ]);
    expect(() => readRequiredDocuments([{ docType: 'bad type', label: 'x' }])).toThrow();
  });
});
