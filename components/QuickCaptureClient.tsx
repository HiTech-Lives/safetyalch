'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type PhotoItem = {
  id: string;
  name: string;
  location: string;
  caption: string;
  kind: 'hazard' | 'positive' | 'documentation';
};

export default function QuickCaptureClient({
  members,
  jobs,
  initialMemberId,
  initialSiteId,
  initialJobId,
}: {
  members: any[];
  jobs: any[];
  initialMemberId?: string;
  initialSiteId?: string;
  initialJobId?: string;
}) {
  const router = useRouter();
  const defaultMember = members.find(m => m.id === initialMemberId) || members.find(m => m.id === 'm8') || members[0];
  const [memberId, setMemberId] = useState<string>(defaultMember?.id || '');
  const selectedMember = members.find(m => m.id === memberId) || defaultMember;
  const [siteId, setSiteId] = useState<string>(initialSiteId || selectedMember?.sites?.[0]?.id || '');
  const [jobId, setJobId] = useState<string>(initialJobId || jobs.find(j => j.member_id === memberId)?.id || '');
  const [aiAssist, setAiAssist] = useState(true);

  const [photos, setPhotos] = useState<PhotoItem[]>([
    {
      id: 'p1',
      name: 'IMG_4012_west_dock_ladder.jpg',
      location: 'West Loading Dock Roof Access',
      caption:
        'AI Vision: 24-ft fiberglass extension ladder side rails extend only ~18 inches above the parapet cap and lack a top tie-off.',
      kind: 'hazard',
    },
    {
      id: 'p2',
      name: 'IMG_4013_north_perimeter_flagging.jpg',
      location: 'North Roof Perimeter / Bay 4',
      caption: 'AI Vision: Two perimeter warning line stanchions tipped over; flagging sagging below 30 inches.',
      kind: 'hazard',
    },
    {
      id: 'p3',
      name: 'IMG_4014_center_hatch_guardrail.jpg',
      location: 'Center Roof Hatch',
      caption: 'AI Vision: Compliant tubular steel guardrail and self-closing gate around main roof hatch.',
      kind: 'positive',
    },
  ]);

  const [voiceTranscript, setVoiceTranscript] = useState(
    'Walking the west loading dock at Cal Plains Roofing with Jorge Medina. We have an unsecured fiberglass extension ladder used by Delta Sheet Metal Subcontractors that only extends about 18 inches past the parapet cap and is not tied off. Also on the north perimeter near Bay 4, two warning line stanchions are tipped over.'
  );
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [sttModelUsed, setSttModelUsed] = useState('elevenlabs:scribe_v1');
  const [analyzing, setAnalyzing] = useState(false);
  const [draftObservations, setDraftObservations] = useState<any[] | null>(null);
  const [modelUsed, setModelUsed] = useState('');
  const [publishing, setPublishing] = useState(false);

  function handlePhotoFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const added: PhotoItem[] = files.map((f, idx) => ({
      id: 'p-' + Date.now() + '-' + idx,
      name: f.name,
      location: selectedMember?.sites?.[0]?.name || 'Main Work Area',
      caption: aiAssist
        ? `AI Vision (${f.name}): Field condition captured at ${selectedMember?.name}; ready for regulatory synthesis.`
        : '',
      kind: 'hazard',
    }));
    setPhotos(prev => [...prev, ...added]);
  }

  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setTranscribing(true);
    const siteObj = selectedMember?.sites?.find((s: any) => s.id === siteId) || selectedMember?.sites?.[0];

    let audioBase64 = '';
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      audioBase64 = typeof btoa !== 'undefined' ? btoa(binary) : '';
    } catch {
      // fallback if file read fails
    }

    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'transcribe_audio',
        fileName: file.name,
        mimeType: file.type || 'audio/mp4',
        audioBase64,
        memberName: selectedMember?.name || 'Cal Plains Roofing',
        siteName: siteObj?.name || 'Primary Site',
      }),
    });
    const data = await res.json();
    setTranscribing(false);
    if (data.ok && data.transcript) {
      setVoiceTranscript(prev => (prev ? `${prev}\n${data.transcript}` : data.transcript));
      if (data.model_used) setSttModelUsed(data.model_used);
    }
  }

  async function handleToggleRecording() {
    if (!recording) {
      setRecording(true);
      return;
    }
    setRecording(false);
    setTranscribing(true);
    const siteObj = selectedMember?.sites?.find((s: any) => s.id === siteId) || selectedMember?.sites?.[0];
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'transcribe_audio',
        fileName: 'live_voice_memo.webm',
        memberName: selectedMember?.name || 'Cal Plains Roofing',
        siteName: siteObj?.name || 'Primary Site',
      }),
    });
    const data = await res.json();
    setTranscribing(false);
    if (data.ok && data.transcript) {
      setVoiceTranscript(data.transcript);
      if (data.model_used) setSttModelUsed(data.model_used);
    }
  }

  async function handleSaveAndReview() {
    setAnalyzing(true);
    const siteObj = selectedMember?.sites?.find((s: any) => s.id === siteId) || selectedMember?.sites?.[0];
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'analyze_capture',
        memberName: selectedMember?.name || 'Cal Plains Roofing',
        siteName: siteObj?.name || 'Primary Site',
        jurisdiction: siteObj?.jurisdiction || 'CA',
        photos,
        voiceTranscript,
      }),
    });
    const data = await res.json();
    setAnalyzing(false);
    if (data.ok) {
      setDraftObservations(data.observations || []);
      setModelUsed(data.model_used || 'aws_bedrock:qwen.qwen2.5-vl-72b-instruct');
    }
  }

  async function handlePublishObservations() {
    if (!draftObservations) return;
    setPublishing(true);
    await fetch('/api/observations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'publish_observations',
        member_id: memberId,
        site_id: siteId,
        job_id: jobId || null,
        voice_transcript: voiceTranscript,
        observations: draftObservations,
      }),
    });
    setPublishing(false);
    router.push(`/field/quick-report?member=${memberId}&site=${siteId}&job=${jobId}`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Context Bar (Locked to Route Stop / Policyholder) */}
      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="kicker">Step 1 · Field Walk Evidence Capture</div>
            <span className="card-title">AI Quick Capture (Numbered Photos + Voice Memo)</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={aiAssist} onChange={e => setAiAssist(e.target.checked)} />
            <span className="chip ok">AI Assist {aiAssist ? 'ON' : 'OFF'}</span>
          </label>
        </div>

        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div className="field">
            <label>Policyholder / Member</label>
            <select
              value={memberId}
              onChange={e => {
                setMemberId(e.target.value);
                const m = members.find(x => x.id === e.target.value);
                if (m?.sites?.[0]) setSiteId(m.sites[0].id);
              }}
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.city})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Site Location</label>
            <select value={siteId} onChange={e => setSiteId(e.target.value)}>
              {(selectedMember?.sites || []).map((st: any) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.jurisdiction})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Linked Work Queue Job</label>
            <select value={jobId} onChange={e => setJobId(e.target.value)}>
              <option value="">— Standalone Site Walk —</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>
                  {j.id} · {j.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Numbered Photos Section (Matches "1 of 3", "2 of 3", "3 of 3" at 02:48 in Video) */}
      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
          <span className="card-title">Captured Site Photos ({photos.length})</span>
          <label className="btn btn-sm btn-acc" style={{ cursor: 'pointer' }}>
            + Snap / Upload Photos
            <input type="file" accept="image/*" multiple onChange={handlePhotoFiles} style={{ display: 'none' }} />
          </label>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {photos.map((p, idx) => (
            <div
              key={p.id}
              style={{
                padding: 14,
                border: '1px solid var(--line)',
                background: 'var(--bg-soft)',
                borderRadius: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="chip mono" style={{ fontWeight: 700 }}>
                    {idx + 1} of {photos.length}
                  </span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                    {p.name}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  {(['hazard', 'positive', 'documentation'] as const).map(k => (
                    <button
                      key={k}
                      type="button"
                      className={'btn btn-sm ' + (p.kind === k ? (k === 'hazard' ? 'btn-acc' : 'btn-primary') : '')}
                      onClick={() =>
                        setPhotos(prev => prev.map((item, i) => (i === idx ? { ...item, kind: k } : item)))
                      }
                    >
                      {k.charAt(0).toUpperCase() + k.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <div className="field">
                  <label>Specific location (optional)</label>
                  <input
                    type="text"
                    value={p.location}
                    onChange={e =>
                      setPhotos(prev => prev.map((item, i) => (i === idx ? { ...item, location: e.target.value } : item)))
                    }
                    placeholder="e.g. West Loading Dock Parapet"
                  />
                </div>
                <div className="field">
                  <label>AI Initial Photo Description</label>
                  <input
                    type="text"
                    value={p.caption}
                    onChange={e =>
                      setPhotos(prev => prev.map((item, i) => (i === idx ? { ...item, caption: e.target.value } : item)))
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Voice Memo Recorder & Transcript (Matches 02:58 - 03:08 in Video + ElevenLabs Scribe STT) */}
      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="card-title">Voice Memo &amp; Field Dictation</span>
              <span className="chip ok mono" style={{ fontSize: 10.5 }}>
                STT: {sttModelUsed}
              </span>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              Speak your findings once during the site walk—ElevenLabs Scribe v1 transcribes with speaker diarization &amp; AI extracts OSHA citations
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={'btn btn-sm ' + (recording ? 'btn-acc' : '')}
              disabled={transcribing}
              onClick={handleToggleRecording}
            >
              {transcribing
                ? 'Transcribing via ElevenLabs Scribe...'
                : recording
                ? '● Stop & Transcribe (ElevenLabs Scribe)'
                : '🎙 Record Voice Memo'}
            </button>
            <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
              Upload Audio (.m4a / .mp3 / .wav)
              <input
                type="file"
                accept=".m4a,.mp3,.wav,.ogg,.webm,audio/*"
                onChange={handleAudioUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label>Transcribed Voice Memo (Editable)</label>
            <textarea rows={4} value={voiceTranscript} onChange={e => setVoiceTranscript(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link href="/observations" className="btn btn-sm">
              View Observation List →
            </Link>
            <button type="button" className="btn btn-acc" disabled={analyzing} onClick={handleSaveAndReview}>
              {analyzing ? 'Synthesizing Observations & Citations...' : 'Save & Review AI Observations →'}
            </button>
          </div>
        </div>
      </div>

      {/* Save & Review AI-Drafted Hazard Observations (Matches 03:10 - 03:22 in Video) */}
      {draftObservations && (
        <div className="card" style={{ border: '2px solid var(--acc)' }}>
          <div className="card-head">
            <div>
              <div className="kicker">AI Hazard &amp; Citation Synthesis ({modelUsed})</div>
              <span className="card-title">Review Drafted Observations Before Publishing</span>
            </div>
            <span className="chip ok">Federal 29 CFR + State Citations Paired</span>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {draftObservations.map((obs, idx) => (
              <div
                key={idx}
                style={{
                  padding: 16,
                  background: 'var(--bg-soft)',
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                  <div className="field">
                    <label>Observation Title</label>
                    <input
                      type="text"
                      value={obs.title}
                      onChange={e =>
                        setDraftObservations(prev =>
                          prev!.map((o, i) => (i === idx ? { ...o, title: e.target.value } : o))
                        )
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Assign to Company (Extracted from Voice)</label>
                    <input
                      type="text"
                      value={obs.assigned_company}
                      onChange={e =>
                        setDraftObservations(prev =>
                          prev!.map((o, i) => (i === idx ? { ...o, assigned_company: e.target.value } : o))
                        )
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Priority</label>
                    <select
                      value={obs.priority}
                      onChange={e =>
                        setDraftObservations(prev =>
                          prev!.map((o, i) => (i === idx ? { ...o, priority: e.target.value } : o))
                        )
                      }
                    >
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Med">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="field">
                    <label>Hazard Description</label>
                    <textarea
                      rows={3}
                      value={obs.description}
                      onChange={e =>
                        setDraftObservations(prev =>
                          prev!.map((o, i) => (i === idx ? { ...o, description: e.target.value } : o))
                        )
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Recommended Corrective Action</label>
                    <textarea
                      rows={3}
                      value={obs.corrective_action}
                      onChange={e =>
                        setDraftObservations(prev =>
                          prev!.map((o, i) => (i === idx ? { ...o, corrective_action: e.target.value } : o))
                        )
                      }
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div className="field">
                    <label>Federal OSHA Standard</label>
                    <input
                      type="text"
                      className="mono"
                      value={obs.federal_citation}
                      onChange={e =>
                        setDraftObservations(prev =>
                          prev!.map((o, i) => (i === idx ? { ...o, federal_citation: e.target.value } : o))
                        )
                      }
                    />
                  </div>
                  <div className="field">
                    <label>State Standard (Cal/OSHA · WA DOSH)</label>
                    <input
                      type="text"
                      className="mono"
                      value={obs.state_citation}
                      onChange={e =>
                        setDraftObservations(prev =>
                          prev!.map((o, i) => (i === idx ? { ...o, state_citation: e.target.value } : o))
                        )
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Specific Location</label>
                    <input
                      type="text"
                      value={obs.specific_location}
                      onChange={e =>
                        setDraftObservations(prev =>
                          prev!.map((o, i) => (i === idx ? { ...o, specific_location: e.target.value } : o))
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="button"
                className="btn btn-acc"
                disabled={publishing}
                onClick={handlePublishObservations}
              >
                {publishing
                  ? 'Publishing Observations...'
                  : 'Publish Observations & Continue to Quick Report ("In the Truck") →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

