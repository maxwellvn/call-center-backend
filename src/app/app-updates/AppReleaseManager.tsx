"use client";

import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";

type Release = {
  id: string;
  version: string;
  platform: "ANDROID" | "IOS";
  downloadUrl: string;
  releaseNotes: string | null;
  isRequired: boolean;
  isActive: boolean;
  createdAt: string;
};

type Props = {
  initialReleases: Release[];
  adminKeyConfigured: boolean;
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 18,
  border: "1px solid #e8ecf1",
  fontSize: 14,
  outline: "none",
  background: "#ffffff",
  color: "#1a202c",
  boxSizing: "border-box",
};

const sectionStyle: CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  borderRadius: 28,
  padding: 26,
  border: "1px solid rgba(255,255,255,0.45)",
  boxShadow: "0 24px 60px rgba(11, 62, 120, 0.2)",
  backdropFilter: "blur(14px)",
};

const labelStyle: CSSProperties = {
  color: "#1a202c",
  fontSize: 13,
  fontWeight: 700,
};

export function AppReleaseManager({ initialReleases, adminKeyConfigured }: Props) {
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState("");
  const [version, setVersion] = useState("");
  const [platform, setPlatform] = useState<Release["platform"]>("ANDROID");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [releases, setReleases] = useState(initialReleases);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function reloadReleases() {
    const response = await fetch("/api/app-releases", { cache: "no-store" });
    const payload = await response.json();
    setReleases(payload.data ?? []);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/app-releases", {
        method: editingReleaseId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(editingReleaseId ? { id: editingReleaseId } : {}),
          adminKey,
          version,
          platform,
          downloadUrl,
          releaseNotes,
          isRequired,
          isActive,
        }),
      });

      const payload = await response.json();

      if (!response.ok || payload.error) {
        throw new Error(payload.error?.message || "Failed to save app release");
      }

      setStatus(
        editingReleaseId
          ? `Release ${payload.data.version} updated for ${payload.data.platform}.`
          : `Release ${payload.data.version} published for ${payload.data.platform}.`,
      );
      setEditingReleaseId(null);
      setVersion("");
      setDownloadUrl("");
      setReleaseNotes("");
      setIsRequired(false);
      setIsActive(true);
      await reloadReleases();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save app release");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(release: Release) {
    setEditingReleaseId(release.id);
    setVersion(release.version);
    setPlatform(release.platform);
    setDownloadUrl(release.downloadUrl);
    setReleaseNotes(release.releaseNotes || "");
    setIsRequired(release.isRequired);
    setIsActive(release.isActive);
    setStatus(`Editing ${release.platform} ${release.version}`);
  }

  function handleCancelEdit() {
    setEditingReleaseId(null);
    setVersion("");
    setPlatform("ANDROID");
    setDownloadUrl("");
    setReleaseNotes("");
    setIsRequired(false);
    setIsActive(true);
    setStatus("Edit canceled.");
  }

  async function handleDelete(releaseId: string) {
    if (!adminKeyConfigured) {
      setStatus("Configure APP_RELEASE_ADMIN_KEY before deleting releases.");
      return;
    }

    if (!adminKey.trim()) {
      setStatus("Enter the admin key before deleting a release.");
      return;
    }

    if (!window.confirm("Delete this release?")) {
      return;
    }

    setSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/app-releases", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminKey,
          id: releaseId,
        }),
      });

      const payload = await response.json();

      if (!response.ok || payload.error) {
        throw new Error(payload.error?.message || "Failed to delete app release");
      }

      setStatus("Release deleted.");
      await reloadReleases();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete app release");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section style={sectionStyle}>
        <h2 style={{ margin: "0 0 8px", fontSize: 24 }}>
          {editingReleaseId ? "Edit mobile app version" : "Publish a new mobile app version"}
        </h2>
        <p style={{ margin: "0 0 20px", color: "#4a5568", lineHeight: 1.6 }}>
          Add the version number and the direct install link. The mobile app can read the latest active release from
          <code style={{ marginLeft: 6, color: "#10529b", fontWeight: 700 }}>/api/app-releases/latest</code>.
        </p>
        {!adminKeyConfigured ? (
          <p
            style={{
              margin: "0 0 16px",
              padding: 14,
              borderRadius: 18,
              background: "#fff7ed",
              color: "#9a3412",
              border: "1px solid rgba(221, 107, 32, 0.18)",
            }}
          >
            Set <code>APP_RELEASE_ADMIN_KEY</code> in the backend environment before publishing from this page.
          </p>
        ) : null}
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <label htmlFor="adminKey" style={labelStyle}>Admin key</label>
            <input id="adminKey" type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <label htmlFor="version" style={labelStyle}>Version</label>
              <input id="version" value={version} onChange={(event) => setVersion(event.target.value)} placeholder="1.0.1" style={inputStyle} />
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <label htmlFor="platform" style={labelStyle}>Platform</label>
              <select id="platform" value={platform} onChange={(event) => setPlatform(event.target.value as Release["platform"])} style={inputStyle}>
                <option value="ANDROID">Android</option>
                <option value="IOS">iOS</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <label htmlFor="downloadUrl" style={labelStyle}>Download URL</label>
            <input
              id="downloadUrl"
              type="url"
              value={downloadUrl}
              onChange={(event) => setDownloadUrl(event.target.value)}
              placeholder="https://example.com/downloads/call-center.apk"
              style={inputStyle}
            />
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <label htmlFor="releaseNotes" style={labelStyle}>Release notes</label>
            <textarea
              id="releaseNotes"
              value={releaseNotes}
              onChange={(event) => setReleaseNotes(event.target.value)}
              rows={5}
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder="What changed in this release?"
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, color: "#1a202c", fontWeight: 600 }}>
            <input type="checkbox" checked={isRequired} onChange={(event) => setIsRequired(event.target.checked)} />
            Force users to update before continuing
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, color: "#1a202c", fontWeight: 600 }}>
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            Make this the active version for the selected platform
          </label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={submitting || !adminKeyConfigured}
              style={{
                border: 0,
                borderRadius: 999,
                padding: "14px 22px",
                background: submitting ? "#7a99bc" : "#10529b",
                color: "#fff",
                cursor: submitting ? "not-allowed" : "pointer",
                fontWeight: 700,
                boxShadow: "0 14px 26px rgba(16, 82, 155, 0.24)",
              }}
            >
              {submitting ? (editingReleaseId ? "Saving..." : "Publishing...") : editingReleaseId ? "Save changes" : "Publish release"}
            </button>
            {editingReleaseId ? (
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={submitting}
                style={{
                  border: "1px solid #e8ecf1",
                  borderRadius: 999,
                  padding: "14px 22px",
                  background: "#f5f7fa",
                  color: "#10529b",
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontWeight: 700,
                }}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
          {status ? <p style={{ margin: 0, color: "#10529b", fontWeight: 700 }}>{status}</p> : null}
        </form>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: "0 0 16px", fontSize: 24 }}>Published releases</h2>
        <div style={{ display: "grid", gap: 16 }}>
          {releases.length ? (
            releases.map((release) => (
              <article
                key={release.id}
                style={{
                  padding: 20,
                  borderRadius: 22,
                  background: release.isActive ? "#dff6ff" : "#f5f7fa",
                  border: release.isActive
                    ? "1px solid rgba(44, 192, 242, 0.32)"
                    : "1px solid #e8ecf1",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 18, color: "#1a202c" }}>
                    {release.platform} {release.version}
                  </strong>
                  <span style={{ color: "#4a5568", fontWeight: 600 }}>
                    {release.isActive ? "Active" : "Inactive"} • {release.isRequired ? "Required" : "Optional"}
                  </span>
                </div>
                <p style={{ margin: "10px 0", color: "#4a5568", lineHeight: 1.6 }}>
                  {release.releaseNotes || "No release notes provided."}
                </p>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                  <a href={release.downloadUrl} target="_blank" rel="noreferrer" style={{ color: "#10529b", fontWeight: 700 }}>
                    Open download link
                  </a>
                  <button
                    type="button"
                    onClick={() => handleEdit(release)}
                    disabled={submitting}
                    style={{
                      border: 0,
                      padding: 0,
                      background: "transparent",
                      color: submitting ? "#9aa5b4" : "#10529b",
                      cursor: submitting ? "not-allowed" : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Edit release
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(release.id)}
                    disabled={submitting || !adminKeyConfigured}
                    style={{
                      border: 0,
                      padding: 0,
                      background: "transparent",
                      color: submitting ? "#9aa5b4" : "#e53e3e",
                      cursor: submitting ? "not-allowed" : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Delete release
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p style={{ margin: 0, color: "#4a5568" }}>No releases have been published yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
