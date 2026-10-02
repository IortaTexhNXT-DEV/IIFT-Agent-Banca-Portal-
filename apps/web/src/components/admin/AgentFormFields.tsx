import { Col, DatePicker, Form, Input, Row, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { RegisterAgentInput } from '../../api/admin-types';
import { ID_TYPE_OPTIONS } from './agents';

/** Validation patterns mirrored from the API DTOs. */
export const MOBILE_PATTERN = /^\+?[0-9]{7,15}$/;
const ID_NUMBER_PATTERN = /^[A-Za-z0-9-/ ]{5,30}$/;

export interface AgentFormValues {
  fullName: string;
  idType: 'NRIC' | 'PASSPORT';
  idNumber: string;
  dateOfBirth: Dayjs;
  email: string;
  mobile: string;
  address?: string;
  branchName?: string;
  licenceNo?: string;
  licenceExpiry?: Dayjs;
}

export const mobileRule = { pattern: MOBILE_PATTERN, message: '7 to 15 digits, optionally starting with +' };

/** Identity, contact and licensing fields collected for every agent or bank officer (AP-07/48). */
export function AgentFormFields() {
  return (
    <Row gutter={16}>
      <Col xs={24} md={12}>
        <Form.Item name="fullName" label="Full name (as per ID)" rules={[{ required: true, whitespace: true, message: 'Enter the full name' }, { min: 2, max: 150 }]}>
          <Input autoComplete="off" />
        </Form.Item>
      </Col>
      <Col xs={24} md={6}>
        <Form.Item name="idType" label="ID type" rules={[{ required: true, message: 'Choose the ID type' }]}>
          <Select options={[...ID_TYPE_OPTIONS]} />
        </Form.Item>
      </Col>
      <Col xs={24} md={6}>
        <Form.Item name="idNumber" label="IC / passport number" rules={[{ required: true, message: 'Enter the ID number' }, { pattern: ID_NUMBER_PATTERN, message: '5 to 30 letters, digits, spaces, - or /' }]}>
          <Input autoComplete="off" />
        </Form.Item>
      </Col>
      <Col xs={24} md={6}>
        <Form.Item name="dateOfBirth" label="Date of birth" rules={[{ required: true, message: 'Enter the date of birth' }]}>
          <DatePicker
            format="DD MMM YYYY"
            style={{ width: '100%' }}
            disabledDate={(date) => date.isAfter(dayjs(), 'day')}
            defaultPickerValue={dayjs().subtract(30, 'year')}
          />
        </Form.Item>
      </Col>
      <Col xs={24} md={9}>
        <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Enter the email address' }, { type: 'email', message: 'Enter a valid email address' }]}>
          <Input type="email" autoComplete="off" />
        </Form.Item>
      </Col>
      <Col xs={24} md={9}>
        <Form.Item name="mobile" label="Mobile" rules={[{ required: true, message: 'Enter the mobile number' }, mobileRule]}>
          <Input inputMode="tel" placeholder="e.g. 6738123456" />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="address" label="Address" rules={[{ max: 300 }]}>
          <Input />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="branchName" label="Branch" rules={[{ max: 100 }]}>
          <Input />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="licenceNo" label="Licence / registration no." rules={[{ max: 50 }]}>
          <Input />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="licenceExpiry" label="Licence expiry">
          <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
        </Form.Item>
      </Col>
    </Row>
  );
}

/** Empty optional strings are omitted so the API only receives entered values. */
export function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function isoDate(value: Dayjs | undefined | null): string | undefined {
  return value ? value.format('YYYY-MM-DD') : undefined;
}

export function toRegisterInput(values: AgentFormValues): Omit<RegisterAgentInput, 'agentType'> {
  return {
    fullName: values.fullName.trim(),
    idType: values.idType,
    idNumber: values.idNumber.trim(),
    dateOfBirth: values.dateOfBirth.format('YYYY-MM-DD'),
    email: values.email.trim(),
    mobile: values.mobile.trim(),
    address: optional(values.address),
    branchName: optional(values.branchName),
    licenceNo: optional(values.licenceNo),
    licenceExpiry: isoDate(values.licenceExpiry),
  };
}
