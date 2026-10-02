import { Select, type SelectProps } from 'antd';
import { useApiQuery } from '../../api/hooks';
import type { AgencyOption } from '../../api/admin-types';

/** Active agencies and banks (cached, shared by every agency drop-down). */
export function useAgencyOptions() {
  return useApiQuery<AgencyOption[]>('/backoffice/agencies/options');
}

/** Agency or bank picker, searchable by name or code. */
export function AgencySelect(
  props: Omit<SelectProps<string>, 'options' | 'loading' | 'showSearch'>,
) {
  const agencies = useAgencyOptions();
  return (
    <Select<string>
      {...props}
      showSearch={{ optionFilterProp: 'label' }}
      loading={agencies.isLoading}
      options={(agencies.data ?? []).map((agency) => ({
        value: agency.id,
        label: `${agency.name} (${agency.code})`,
      }))}
    />
  );
}
