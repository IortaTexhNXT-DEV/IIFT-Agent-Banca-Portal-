import { Empty, Table } from 'antd';
import type { PolicyDetail, Question } from '../../api/types';

interface Row extends Question {
  answer: boolean | undefined;
  details: string | undefined;
}

/** Health / risk declarations as answered on the application (AP-19). */
export function QuestionnaireAnswers({ questions, answers }: { questions: Question[]; answers: PolicyDetail['questionnaire'] }) {
  if (questions.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="This product has no declarations" />;
  }
  if (!answers) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Declarations not answered yet" />;
  }
  const rows: Row[] = questions.map((question) => {
    const answer = answers.find((candidate) => candidate.code === question.code);
    return { ...question, answer: answer?.answer, details: answer?.details };
  });
  return (
    <Table<Row>
      size="small"
      rowKey="code"
      pagination={false}
      dataSource={rows}
      columns={[
        { title: 'Declaration', dataIndex: 'text' },
        { title: 'Answer', dataIndex: 'answer', width: 90, render: (answer: boolean | undefined) => (answer === undefined ? '–' : answer ? 'Yes' : 'No') },
        { title: 'Details', dataIndex: 'details', render: (details: string | undefined) => details ?? '–' },
      ]}
    />
  );
}
