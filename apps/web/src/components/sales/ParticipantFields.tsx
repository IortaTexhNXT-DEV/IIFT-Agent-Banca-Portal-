import { Col, DatePicker, Form, Input, Row, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { ParticipantInput } from '../../api/sales-types';
import { ISO_DATE } from './options';
import { occupationClassLabel } from './ParticipantProfile';
import { useCodes } from './useCodes';

/** Form values: as CreateParticipantDto, with the date of birth as a date picker value. */
export type ParticipantFormValues = Partial<Omit<ParticipantInput, 'dateOfBirth'>> & {
  dateOfBirth?: Dayjs | null;
};

/** Trims text, drops empty values and formats the date of birth for the API. */
export function toParticipantPayload(values: ParticipantFormValues): Partial<ParticipantInput> {
  const payload: Partial<ParticipantInput> = {};
  for (const [key, value] of Object.entries(values) as [keyof ParticipantFormValues, unknown][]) {
    if (key === 'dateOfBirth') {
      if (dayjs.isDayjs(value)) payload.dateOfBirth = value.format(ISO_DATE);
    } else if (typeof value === 'string') {
      if (value.trim()) Object.assign(payload, { [key]: value.trim() });
    } else if (value !== undefined && value !== null) {
      Object.assign(payload, { [key]: value });
    }
  }
  return payload;
}

const OCCUPATION_CLASS_OPTIONS = [1, 2, 3, 4].map((value) => ({
  value,
  label: occupationClassLabel(value),
}));

/**
 * Particulars and contact details shared by registration and update requests, with the
 * validation rules of the participant DTOs.
 */
export function ParticipantDetailsFields({ individual }: { individual: boolean }) {
  const nationalities = useCodes('NATIONALITY');
  const occupations = useCodes('OCCUPATION');
  const districts = useCodes('DISTRICT');

  return (
    <Row gutter={16}>
      <Col xs={24} md={12}>
        <Form.Item
          name="fullName"
          label={individual ? 'Full name (as in IC)' : 'Company name'}
          rules={[
            { required: true, whitespace: true, message: 'Enter the name' },
            { min: 2, max: 150, message: 'Between 2 and 150 characters' },
          ]}
        >
          <Input maxLength={150} />
        </Form.Item>
      </Col>
      {individual ? (
        <Col xs={24} md={12}>
          <Form.Item
            name="dateOfBirth"
            label="Date of birth"
            rules={[{ required: true, message: 'Enter the date of birth' }]}
          >
            <DatePicker
              className="full-width"
              format="DD MMM YYYY"
              disabledDate={(date) => date.isAfter(dayjs(), 'day')}
            />
          </Form.Item>
        </Col>
      ) : (
        <Col xs={24} md={12}>
          <Form.Item name="contactPerson" label="Contact person" rules={[{ max: 150 }]}>
            <Input maxLength={150} />
          </Form.Item>
        </Col>
      )}
      <Col xs={24} md={12}>
        <Form.Item
          name="nationality"
          label={individual ? 'Nationality' : 'Country of registration'}
        >
          <Select
            allowClear
            showSearch={{ optionFilterProp: 'label' }}
            options={nationalities.options}
            loading={nationalities.loading}
          />
        </Form.Item>
      </Col>
      {individual && (
        <>
          <Col xs={24} md={12}>
            <Form.Item name="occupation" label="Occupation">
              <Select
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                options={occupations.options}
                loading={occupations.loading}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="occupationClass"
              label="Occupational class"
              extra="Class I: professional, managerial, administrative – no manual work"
            >
              <Select allowClear options={OCCUPATION_CLASS_OPTIONS} />
            </Form.Item>
          </Col>
        </>
      )}
      <Col xs={24} md={12}>
        <Form.Item
          name="mobile"
          label="Mobile"
          rules={[
            { required: true, message: 'Enter the mobile number' },
            { pattern: /^\+?[0-9]{7,15}$/, message: '7 to 15 digits, optionally starting with +' },
          ]}
        >
          <Input inputMode="tel" maxLength={16} />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item
          name="email"
          label="E-mail"
          rules={[{ type: 'email', message: 'Enter a valid e-mail address' }, { max: 254 }]}
        >
          <Input inputMode="email" maxLength={254} />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item
          name="addressLine1"
          label="Address line 1"
          rules={[
            { required: true, whitespace: true, message: 'Enter the address' },
            { min: 3, max: 200 },
          ]}
        >
          <Input maxLength={200} />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="addressLine2" label="Address line 2" rules={[{ max: 200 }]}>
          <Input maxLength={200} />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item
          name="postcode"
          label="Postcode"
          rules={[{ pattern: /^[A-Za-z0-9 ]{2,10}$/, message: '2 to 10 letters or digits' }]}
        >
          <Input maxLength={10} />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="district" label="District">
          <Select allowClear options={districts.options} loading={districts.loading} />
        </Form.Item>
      </Col>
    </Row>
  );
}
