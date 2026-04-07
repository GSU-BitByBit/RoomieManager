import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  FileText,
  Save,
  Send,
  History,
  Eye,
  Edit3,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';

import { contracts as contractsApi, groups as groupsApi, ApiError } from '@/lib/api';
import type { ContractResponse, ContractVersion, GroupSummary } from '@/types/api';

type Tab = 'editor' | 'versions';

export default function ContractsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [tab, setTab] = useState<Tab>('editor');
  const [contractData, setContractData] = useState<ContractResponse | null>(null);
  const [group, setGroup] = useState<GroupSummary | null>(null);
  const [versions, setVersions] = useState<ContractVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  const fetchContract = useCallback(async () => {
    if (!groupId) {
      return;
    }

    try {
      const [data, groupData] = await Promise.all([contractsApi.get(groupId), groupsApi.get(groupId)]);
      setContractData(data);
      setGroup(groupData);
      setDraftContent(data.contract.draftContent);
      setDirty(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load contract');
      }
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const fetchVersions = useCallback(async () => {
    if (!groupId) {
      return;
    }

    try {
      const data = await contractsApi.listVersions(groupId, { pageSize: 50 });
      setVersions(data.versions);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  }, [groupId]);

  useEffect(() => {
    fetchContract();
    fetchVersions();
  }, [fetchContract, fetchVersions]);

  const isAdmin = group?.memberRole === 'ADMIN';

  const handleSaveDraft = async () => {
    if (!groupId) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      await contractsApi.updateDraft(groupId, draftContent);
      setDirty(false);
      fetchContract();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to save draft');
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!groupId) {
      return;
    }

    if (!window.confirm('Publish the current draft as a new version? This cannot be undone.')) {
      return;
    }

    setPublishing(true);
    setError('');

    try {
      if (dirty) {
        await contractsApi.updateDraft(groupId, draftContent);
      }

      await contractsApi.publish(groupId);
      fetchContract();
      fetchVersions();
      setDirty(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to publish');
      }
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-sage-200 border-t-sage-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-display text-2xl text-charcoal">Group Contract</h1>
            <p className="mt-1 text-sm text-slate-500">
              {contractData?.contract.publishedVersion
                ? `Published v${contractData.contract.publishedVersion}`
                : 'No published version yet'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard
              label="Published"
              value={
                contractData?.contract.publishedVersion
                  ? `v${contractData.contract.publishedVersion}`
                  : 'None'
              }
            />
            <SummaryCard label="Draft" value={dirty ? 'Unsaved' : contractData?.contract.draftContent ? 'Ready' : 'Empty'} />
            <SummaryCard label="History" value={`${versions.length}`} />
            <SummaryCard
              label="Updated"
              value={
                contractData?.contract.updatedAt
                  ? format(parseISO(contractData.contract.updatedAt), 'MMM d')
                  : 'Never'
              }
            />
          </div>
        </div>

        {error && <div className="mt-4 alert-error">{error}</div>}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTab('editor')}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              tab === 'editor'
                ? 'bg-sage-100 text-sage-700'
                : 'bg-cream-50 text-slate-500 hover:bg-sage-50 hover:text-charcoal'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {isAdmin ? <Edit3 size={16} /> : <Eye size={16} />}
              {isAdmin ? 'Draft Editor' : 'View Draft'}
            </span>
          </button>
          <button
            onClick={() => setTab('versions')}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              tab === 'versions'
                ? 'bg-sage-100 text-sage-700'
                : 'bg-cream-50 text-slate-500 hover:bg-sage-50 hover:text-charcoal'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <History size={16} />
              Version History
            </span>
          </button>

          {tab === 'editor' && isAdmin && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {dirty ? 'Unsaved changes' : 'All changes saved'}
              </span>
              <button
                onClick={handleSaveDraft}
                className="btn-secondary btn-sm"
                disabled={saving || !dirty}
              >
                <Save size={14} />
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={handlePublish}
                className="btn-primary btn-sm"
                disabled={publishing || (!draftContent.trim() && !dirty)}
              >
                <Send size={14} />
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          )}
        </div>
      </div>

      {tab === 'editor' ? (
        <div className="space-y-5">
          {contractData?.latestPublishedContent && (
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Eye size={16} className="text-sage-600" />
                <span className="text-sm font-medium text-sage-700">
                  Latest Published (v{contractData.contract.publishedVersion})
                </span>
              </div>
              <div className="whitespace-pre-wrap rounded-2xl border border-sage-100/60 bg-sage-50/70 p-4 text-sm text-charcoal">
                {contractData.latestPublishedContent}
              </div>
            </div>
          )}

          <div className="card p-5">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-slate-400" />
                <span className="text-sm font-medium text-charcoal">Current Draft</span>
                {dirty && <span className="badge-yellow">Unsaved changes</span>}
              </div>

              {!isAdmin && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <AlertTriangle size={12} />
                  Only admins can edit the contract draft
                </span>
              )}
            </div>

            {isAdmin ? (
              <textarea
                className="input min-h-[400px] resize-y font-mono text-sm"
                value={draftContent}
                onChange={(event) => {
                  setDraftContent(event.target.value);
                  setDirty(true);
                }}
                placeholder={`Write your group contract here...

Examples of things to include:
- Quiet hours
- Guest policy
- Cleaning schedule
- Shared expenses rules
- Kitchen and bathroom etiquette
- Pet policy
- Move-out notice period`}
              />
            ) : (
              <div className="min-h-[240px] whitespace-pre-wrap rounded-2xl border border-sage-100/60 bg-cream-50/60 p-4 text-sm text-charcoal">
                {draftContent || <span className="italic text-slate-400">No draft content yet</span>}
              </div>
            )}
          </div>
        </div>
      ) : versions.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-50">
            <History className="h-6 w-6 text-sage-300" />
          </div>
          <h3 className="font-display text-xl text-charcoal">No published versions</h3>
          <p className="mt-2 text-sm text-slate-500">
            {isAdmin
              ? 'Write a draft and publish it to create the first version.'
              : 'The admin has not published any contract versions yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((version) => (
            <div key={version.id} className="card">
              <button
                className="flex w-full items-center justify-between gap-4 p-5 text-left"
                onClick={() =>
                  setExpandedVersion(expandedVersion === version.version ? null : version.version)
                }
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-charcoal">
                      Version {version.version}
                    </span>
                    {version.version === contractData?.contract.publishedVersion && (
                      <span className="badge-green">Latest</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Published {format(parseISO(version.createdAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>

                {expandedVersion === version.version ? (
                  <ChevronUp size={18} className="text-slate-400" />
                ) : (
                  <ChevronDown size={18} className="text-slate-400" />
                )}
              </button>

              {expandedVersion === version.version && (
                <div className="border-t border-sage-100/50 px-5 pb-5 pt-4">
                  <div className="whitespace-pre-wrap rounded-2xl border border-sage-100/50 bg-cream-50/60 p-4 text-sm text-charcoal">
                    {version.content}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sage-100/50 bg-cream-50/60 px-4 py-3 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-charcoal">{value}</p>
    </div>
  );
}
