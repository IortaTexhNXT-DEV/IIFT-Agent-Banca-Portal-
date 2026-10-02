import { Descriptions, type DescriptionsProps } from 'antd';
import { Link } from 'react-router';
import type { Participant } from '../../api/types';
import { formatDate, formatDateTime, humanise } from '../../utils/format';
import { StatusTag } from '../StatusTag';
import { ID_TYPE_LABELS } from './options';
import { useCodes } from './useCodes';
import { useSalesLinks } from './useSalesLinks';

const CLASS_NUMERALS = ['I', 'II', 'III', 'IV'];

export function occupationClassLabel(value: number | null): string {
  return value ? `Class ${CLASS_NUMERALS[value - 1] ?? value}` : '–';
}

interface Props {
  participant: Participant;
  /** Key facts only, with the name linking to the participant record (used on policy pages). */
  compact?: boolean;
}

/** Participant particulars with the identification number masked (AP-11..16). */
export function ParticipantProfile({ participant, compact = false }: Props) {
  const links = useSalesLinks();
  const nationalities = useCodes('NATIONALITY');
  const occupations = useCodes('OCCUPATION');
  const districts = useCodes('DISTRICT');
  const individual = participant.type === 'INDIVIDUAL';
  const address = [participant.addressLine1, participant.addressLine2, participant.postcode, districts.label(participant.district)].filter(Boolean).join(', ');

  const items: DescriptionsProps['items'] = [
    {
      key: 'name',
      label: individual ? 'Name' : 'Company name',
      children: compact ? <Link to={links.participant(participant.id)}>{participant.fullName}</Link> : participant.fullName,
    },
    { key: 'no', label: 'Participant no.', children: participant.participantNo },
    { key: 'id', label: ID_TYPE_LABELS[participant.idType] ?? participant.idType, children: participant.idNumberMasked },
    ...(individual
      ? [
          {
            key: 'dob',
            label: 'Date of birth',
            children: `${formatDate(participant.dateOfBirth)}${participant.ageNextBirthday ? ` (age next birthday ${participant.ageNextBirthday})` : ''}`,
          },
        ]
      : []),
    { key: 'mobile', label: 'Mobile', children: participant.mobile },
    { key: 'email', label: 'E-mail', children: participant.email ?? '–' },
    { key: 'aml', label: 'AML screening', children: <StatusTag status={participant.amlStatus} /> },
  ];

  if (!compact) {
    items.push(
      { key: 'type', label: 'Type', children: humanise(participant.type) },
      ...(individual
        ? [
            { key: 'gender', label: 'Gender', children: humanise(participant.gender) },
            { key: 'occupation', label: 'Occupation', children: occupations.label(participant.occupation) },
            { key: 'class', label: 'Occupational class', children: occupationClassLabel(participant.occupationClass) },
          ]
        : [{ key: 'contact', label: 'Contact person', children: participant.contactPerson ?? '–' }]),
      { key: 'nationality', label: individual ? 'Nationality' : 'Country of registration', children: nationalities.label(participant.nationality) },
      { key: 'address', label: 'Address', children: address, span: 2 },
      { key: 'screened', label: 'Last screened', children: formatDateTime(participant.amlScreenedAt) },
      { key: 'registered', label: 'Registered', children: formatDate(participant.createdAt) },
    );
  }

  return <Descriptions size="small" column={compact ? 1 : { xs: 1, md: 2, xl: 3 }} items={items} />;
}
