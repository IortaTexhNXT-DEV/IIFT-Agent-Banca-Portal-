import { Link } from 'react-router';
import type { Participant } from '../../api/types';
import { formatDate, formatDateTime, humanise } from '../../utils/format';
import { type FieldItem, FieldGrid } from '../FieldGrid';
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
  const address = [
    participant.addressLine1,
    participant.addressLine2,
    participant.postcode,
    districts.label(participant.district),
  ]
    .filter(Boolean)
    .join(', ');

  const items: FieldItem[] = [
    {
      key: 'name',
      label: individual ? 'Name' : 'Company name',
      value: compact ? (
        <Link to={links.participant(participant.id)}>{participant.fullName}</Link>
      ) : (
        participant.fullName
      ),
    },
    { key: 'no', label: 'Participant no.', value: participant.participantNo },
    {
      key: 'id',
      label: ID_TYPE_LABELS[participant.idType] ?? participant.idType,
      value: participant.idNumberMasked,
    },
    ...(individual
      ? [
          {
            key: 'dob',
            label: 'Date of birth',
            value: `${formatDate(participant.dateOfBirth)}${participant.ageNextBirthday ? ` (age next birthday ${participant.ageNextBirthday})` : ''}`,
          },
        ]
      : []),
    { key: 'mobile', label: 'Mobile', value: participant.mobile },
    { key: 'aml', label: 'AML screening', value: <StatusTag status={participant.amlStatus} /> },
    { key: 'email', label: 'E-mail', value: participant.email, span: compact ? 2 : 1 },
  ];

  if (!compact) {
    items.push(
      { key: 'type', label: 'Type', value: humanise(participant.type) },
      ...(individual
        ? [
            { key: 'gender', label: 'Gender', value: humanise(participant.gender) },
            {
              key: 'occupation',
              label: 'Occupation',
              value: occupations.label(participant.occupation),
            },
            {
              key: 'class',
              label: 'Occupational class',
              value: occupationClassLabel(participant.occupationClass),
            },
          ]
        : [{ key: 'contact', label: 'Contact person', value: participant.contactPerson ?? '–' }]),
      {
        key: 'nationality',
        label: individual ? 'Nationality' : 'Country of registration',
        value: nationalities.label(participant.nationality),
      },
      { key: 'address', label: 'Address', value: address, span: 2 },
      {
        key: 'screened',
        label: 'Last screened',
        value: formatDateTime(participant.amlScreenedAt),
      },
      { key: 'registered', label: 'Registered', value: formatDate(participant.createdAt) },
    );
  }

  return <FieldGrid columns={compact ? 2 : 3} items={items} />;
}
