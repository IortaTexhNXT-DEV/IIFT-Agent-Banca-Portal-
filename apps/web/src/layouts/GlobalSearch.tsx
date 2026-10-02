import { SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { AutoComplete, Spin } from 'antd';
import { type ComponentRef, type ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api/client';
import type { AgentView, Page, Participant, PolicySummary } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { AGENT_TYPE_LABELS } from '../components/admin/agents';
import { StatusTag } from '../components/StatusTag';
import { policyReference } from '../components/sales/options';
import { P } from '../utils/permissions';

const MIN_LENGTH = 2;
const DEBOUNCE_MS = 300;
const RESULTS_PER_GROUP = 5;

interface Result {
  value: string;
  label: ReactNode;
}

function ResultRow({ title, meta, status }: { title: string; meta: string; status?: string }) {
  return (
    <div className="search-result">
      <div className="search-result__body">
        <div className="search-result__title">{title}</div>
        <div className="search-result__meta">{meta}</div>
      </div>
      {status && <StatusTag status={status} />}
    </div>
  );
}

/** First page of a list endpoint filtered by `search`; idle until the term is long enough. */
function useSearch<T>(path: string | null, term: string, toResult: (item: T) => Result) {
  const query = useQuery({
    queryKey: [path, 'global-search', term],
    queryFn: () => api.get<Page<T>>(path!, { search: term, page: 1, pageSize: RESULTS_PER_GROUP }),
    enabled: path !== null && term.length >= MIN_LENGTH,
    staleTime: 30_000,
  });
  return { loading: query.isFetching, results: (query.data?.items ?? []).map(toResult) };
}

function useDebounced(value: string): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);
  return debounced;
}

/**
 * Header search across the records the user may open: policies and quotations,
 * participants, and agents (back-office) or team members (portal). Ctrl+K focuses it.
 */
export function GlobalSearch({ basePath }: { basePath: '/portal' | '/backoffice' }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const input = useRef<ComponentRef<typeof AutoComplete>>(null);
  const [text, setText] = useState('');
  const term = useDebounced(text.trim());
  const portal = basePath === '/portal';

  const policies = useSearch<PolicySummary>(
    can(portal ? P.portalPoliciesView : P.boPoliciesView) ? `${basePath}/policies` : null,
    term,
    (policy) => ({
      value: `${basePath}/policies/${policy.id}`,
      label: (
        <ResultRow
          title={policyReference(policy)}
          meta={`${policy.participant.fullName} · ${policy.product.name}`}
          status={policy.status}
        />
      ),
    }),
  );
  const participants = useSearch<Participant>(
    can(portal ? P.portalParticipantsView : P.boParticipantsView)
      ? `${basePath}/participants`
      : null,
    term,
    (participant) => ({
      value: `${basePath}/participants/${participant.id}`,
      label: (
        <ResultRow
          title={participant.fullName}
          meta={`${participant.participantNo} · ${participant.idNumberMasked}`}
        />
      ),
    }),
  );
  const agents = useSearch<AgentView>(
    can(portal ? P.portalHierarchyView : P.boAgentsView)
      ? portal
        ? '/portal/agents'
        : '/backoffice/agents'
      : null,
    term,
    (agent) => ({
      value: portal ? `/portal/team/${agent.id}` : `/backoffice/agents/${agent.id}`,
      label: (
        <ResultRow
          title={agent.fullName}
          meta={`${agent.agentCode} · ${AGENT_TYPE_LABELS[agent.agentType]} · ${agent.agency.name}`}
          status={agent.status}
        />
      ),
    }),
  );

  useEffect(() => {
    const focus = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', focus);
    return () => window.removeEventListener('keydown', focus);
  }, []);

  const groups = [
    { label: 'Policies & quotations', options: policies.results },
    { label: 'Participants', options: participants.results },
    { label: portal ? 'Team' : 'Agents & bankers', options: agents.results },
  ].filter((group) => group.options.length > 0);
  const loading = policies.loading || participants.loading || agents.loading;
  const searching = term.length >= MIN_LENGTH;

  return (
    <AutoComplete
      ref={input}
      className="global-search"
      value={text}
      options={searching ? groups : []}
      onSearch={setText}
      onSelect={(path: string) => {
        setText('');
        input.current?.blur();
        navigate(path);
      }}
      notFoundContent={
        searching && (loading ? <Spin size="small" /> : <span className="muted">No matches</span>)
      }
      popupMatchSelectWidth={420}
      allowClear
      prefix={<SearchOutlined className="muted" />}
      suffixIcon={text ? null : <kbd className="global-search__kbd">Ctrl K</kbd>}
      placeholder={
        portal
          ? 'Search policy, quotation, participant or agent'
          : 'Search policy, participant or agent'
      }
      aria-label="Search records"
    />
  );
}
