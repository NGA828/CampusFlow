"use client";
import { useCallback, useRef, useState } from "react";
import { adminApi } from "@/lib/api/endpoints";
import {
  confirmPerson,
  identity,
  record,
  type ScopeAssignment,
} from "@/lib/api/coordination";
import { errorMessage } from "@/components/layout/student-companion";
import { useOperator } from "@/lib/use-operator";
import { useAuth } from "@/lib/auth/auth-context";
import type { AdminUser, Role } from "@/lib/api/types";
import { Button, Modal } from "@/components/ui/kit";
import {
  CoordinationHeader,
  Empty,
  Feedback,
  Pager,
  ReadState,
} from "@/components/layout/coordination";
import s from "@/components/layout/coordination.module.css";
const roles: Role[] = ["student", "staff", "admin", "visitor"];
const newPerson = () => ({
  name: "",
  email: "",
  role_code: "student" as Role,
  registration_no: "",
  department: "",
  password: "",
});
const newAssignment = () => ({
  user_id: "",
  scope_type: "building",
  scope_id: "",
  role_in_scope: "staff",
  can_call_tickets: true,
  can_manage_timetable: false,
  can_publish_content: false,
});
type Review =
  | { kind: "role" | "reset" | "deactivate"; person: AdminUser; role?: Role }
  | { kind: "assignment"; assignment: ScopeAssignment };
export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [tab, setTab] = useState<"users" | "assignments">("users"),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [role, setRole] = useState(""),
    [page, setPage] = useState(1);
  const users = useOperator(
    useCallback(
      async () => ({
        ...(await adminApi.users({
          q: query || undefined,
          role: role || undefined,
          page,
          per_page: 25,
        })),
        key: `${query}/${role}/${page}`,
      }),
      [query, role, page],
    ),
  );
  const assignments = useOperator(
    useCallback(() => adminApi.staffAssignments(), []),
  );
  const data =
    users.data?.key === `${query}/${role}/${page}` ? users.data : null;
  const [selected, setSelected] = useState<AdminUser | null>(null),
    [profile, setProfile] = useState({ status: "active", department: "" }),
    [nextRole, setNextRole] = useState<Role>("student");
  const [createOpen, setCreateOpen] = useState(false),
    [draft, setDraft] = useState(newPerson),
    [assignmentOpen, setAssignmentOpen] = useState(false),
    [assignment, setAssignment] = useState(newAssignment),
    [review, setReview] = useState<Review | null>(null),
    [secret, setSecret] = useState<{ name: string; password: string } | null>(
      null,
    ),
    [formError, setFormError] = useState<string | null>(null);
  const busy = users.busy || assignments.busy,
    lock = useRef(false),
    editor = useRef<HTMLElement>(null);
  const focus = () => requestAnimationFrame(() => editor.current?.focus());
  const act = async (
    domain: "users" | "assignments",
    fn: () => Promise<void>,
    message: string,
  ) => {
    if (lock.current) return;
    lock.current = true;
    setFormError(null);
    try {
      await (domain === "users" ? users : assignments).act(async () => {
        try {
          await fn();
        } catch (e) {
          setFormError(errorMessage(e, "The change could not be confirmed."));
          throw e;
        }
      }, message);
    } finally {
      lock.current = false;
    }
  };
  const choose = (p: AdminUser) => {
    setSelected(p);
    setProfile({ status: p.status, department: p.department || "" });
    setNextRole(p.role_code);
    setFormError(null);
    focus();
  };
  const beginReview = (r: Review) => {
    setFormError(null);
    setReview(r);
  };
  const create = () => {
    if (
      !draft.name.trim() ||
      !draft.email.includes("@") ||
      (draft.password && draft.password.length < 8)
    ) {
      setFormError(
        "Enter a name, valid email and a password of at least eight characters, or leave it blank.",
      );
      return;
    }
    void act(
      "users",
      async () => {
        const r = await adminApi.createUser({
          ...draft,
          name: draft.name.trim(),
          email: draft.email.trim(),
          password: draft.password || undefined,
          registration_no: draft.registration_no || undefined,
          department: draft.department || undefined,
        });
        confirmPerson(r.user, r.user.id, {
          name: draft.name.trim(),
          email: draft.email.trim(),
          role_code: draft.role_code,
        });
        if (!draft.password && !r.password)
          throw new Error(
            "The account response omitted the generated password. Do not create it again; refresh and use password reset.",
          );
        setCreateOpen(false);
        setDraft(newPerson());
        if (r.password) setSecret({ name: r.user.name, password: r.password });
      },
      "Account creation confirmed. Use search to find it in the directory.",
    );
  };
  const saveProfile = () => {
    if (!selected) return;
    void act(
      "users",
      async () => {
        const r = await adminApi.updateUser(selected.id, {
          status: profile.status,
          department: profile.department || null,
        });
        confirmPerson(r.user, selected.id, {
          status: profile.status,
          department: profile.department || null,
        });
        setSelected(r.user);
      },
      "Profile changes confirmed.",
    );
  };
  const confirm = () => {
    if (!review) return;
    const r = review;
    void act(
      r.kind === "assignment" ? "assignments" : "users",
      async () => {
        if (r.kind === "assignment")
          await adminApi.deleteAssignment(r.assignment.id);
        else if (r.kind === "role") {
          const result = await adminApi.setUserRole(r.person.id, r.role!);
          confirmPerson(result.user, r.person.id, { role_code: r.role });
          setSelected(result.user);
          setNextRole(result.user.role_code);
        } else if (r.kind === "reset") {
          const result = await adminApi.resetUserPassword(r.person.id);
          setSecret({
            name: r.person.name,
            password: identity(result.password),
          });
        } else {
          await adminApi.deleteUser(r.person.id);
          setSelected(null);
        }
        setReview(null);
      },
      r.kind === "assignment"
        ? "Assignment removal confirmed."
        : r.kind === "role"
          ? "Role change confirmed."
          : r.kind === "reset"
            ? "Password reset confirmed."
            : "Account deactivation confirmed.",
    );
  };
  const addAssignment = () => {
    void act(
      "assignments",
      async () => {
        const result = await adminApi.createAssignment(assignment);
        const row = record(result.assignment);
        identity(row.id);
        for (const [k, v] of Object.entries(assignment))
          if (row[k] !== v)
            throw new Error(
              "The assignment response did not match the requested scope and flags. Refresh before retrying.",
            );
        setAssignmentOpen(false);
        setAssignment(newAssignment());
      },
      "Assignment saved. Effective access is enforced by the server’s policies.",
    );
  };
  const meta = assignments.data;
  const scopeLabel = (a: ScopeAssignment) =>
    meta?.scopes[a.scope_type]?.find((x) => x.id === a.scope_id)?.label ||
    a.scope_id ||
    a.scope_type;
  const noActions = busy || users.loading || !!users.error || !data;
  return (
    <div className={s.page}>
      <CoordinationHeader
        eyebrow="Administration / people & access"
        title="Users & roles"
        description="Know who has access, what role they hold and where their staff work belongs."
      >
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            tab === "users" ? users.refresh() : assignments.refresh()
          }
        >
          Refresh directory
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            setFormError(null);
            setCreateOpen(true);
          }}
        >
          New user
        </Button>
      </CoordinationHeader>
      <div className={s.tabs} aria-label="People workspace">
        <button
          aria-pressed={tab === "users"}
          disabled={busy}
          onClick={() => setTab("users")}
        >
          Users
        </button>
        <button
          aria-pressed={tab === "assignments"}
          disabled={busy}
          onClick={() => setTab("assignments")}
        >
          Staff assignments
        </button>
      </div>
      {!createOpen && !assignmentOpen && !review ? (
        <Feedback
          value={tab === "users" ? users.feedback : assignments.feedback}
        />
      ) : null}
      {tab === "users" ? (
        <>
          <form
            className={s.filters}
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setQuery(search.trim());
              setSelected(null);
            }}
          >
            <label className={s.field}>
              Search people
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email or registration number"
                disabled={busy}
              />
            </label>
            <label className={s.field} style={{ maxWidth: 220 }}>
              Filter by role
              <select
                value={role}
                disabled={busy}
                onChange={(e) => {
                  setRole(e.target.value);
                  setPage(1);
                  setSelected(null);
                }}
              >
                <option value="">All roles</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={busy}>
              Search users
            </Button>
          </form>
          <div className={s.split}>
            <section className={s.panel} id="people-directory" tabIndex={-1}>
              <div className={s.panelHead}>
                <div>
                  <p className={s.eyebrow}>Campus directory</p>
                  <h2>People & account status</h2>
                </div>
                <span className={s.pill}>
                  {data
                    ? `${data.meta.total} matching accounts`
                    : "Awaiting directory"}
                </span>
              </div>
              <ReadState
                loading={users.loading || (!data && !users.error)}
                error={users.error}
                retry={users.refresh}
              />
              {!users.loading && !users.error && data ? (
                <>
                  {data.items.length ? (
                    <div
                      className={s.tableRegion}
                      role="region"
                      aria-label="Data table, scroll horizontally for more columns"
                      tabIndex={0}
                    >
                      <table className={s.table}>
                        <thead>
                          <tr>
                            <th scope="col">Person</th>
                            <th scope="col">Role & status</th>
                            <th scope="col">Department / registration</th>
                            <th scope="col">Access</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.items.map((p) => (
                            <tr
                              key={p.id}
                              data-selected={selected?.id === p.id}
                            >
                              <td>
                                <strong>{p.name}</strong>
                                <p>{p.email}</p>
                              </td>
                              <td>
                                <span className={s.pill}>{p.role_code}</span>
                                <p>{p.status}</p>
                              </td>
                              <td>
                                {p.department || "Not supplied"}
                                <p>
                                  {p.registration_no ||
                                    "No registration supplied"}
                                </p>
                              </td>
                              <td>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => choose(p)}
                                  aria-label={`Review ${p.name}`}
                                >
                                  Review access
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty title="No users match">
                      Adjust the search or role filter, or return to a previous
                      page.
                    </Empty>
                  )}
                  <Pager
                    page={data.meta.page}
                    pages={data.meta.total_pages}
                    total={data.meta.total}
                    busy={busy}
                    onPage={(p) => {
                      setPage(p);
                      setSelected(null);
                    }}
                  />
                </>
              ) : null}
            </section>
            <aside
              className={`${s.panel} ${s.editor}`}
              ref={editor}
              tabIndex={-1}
              aria-label="Account access workspace"
              data-active={!!selected}
            >
              <p className={s.eyebrow}>Account access review</p>
              {selected ? (
                <>
                  <h2>{selected.name}</h2>
                  <p className={s.muted}>{selected.email}</p>
                  <div className={s.rule}>
                    <h3>Profile & sign-in status</h3>
                    <form
                      className={s.form}
                      style={{ marginTop: 16 }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveProfile();
                      }}
                    >
                      <fieldset disabled={noActions} className={s.form}>
                        <label className={s.field}>
                          Account status
                          <select
                            value={profile.status}
                            onChange={(e) =>
                              setProfile({ ...profile, status: e.target.value })
                            }
                          >
                            {!["active", "suspended"].includes(
                              profile.status,
                            ) ? (
                              <option value={profile.status}>
                                {profile.status}
                              </option>
                            ) : null}
                            <option value="active">Active</option>
                            <option
                              value="suspended"
                              disabled={selected.id === me?.id}
                            >
                              Suspended
                            </option>
                          </select>
                        </label>
                        <label className={s.field}>
                          Department
                          <input
                            value={profile.department}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                department: e.target.value,
                              })
                            }
                          />
                        </label>
                        <Button
                          type="submit"
                          disabled={
                            profile.status === selected.status &&
                            profile.department === (selected.department || "")
                          }
                        >
                          Save profile
                        </Button>
                      </fieldset>
                    </form>
                  </div>
                  <div className={s.rule}>
                    <h3>Role & authority</h3>
                    <p className={s.muted}>
                      A role change is a separate audited operation. It does not
                      save profile edits.
                    </p>
                    <label className={`${s.field} ${s.back}`}>
                      Account role
                      <select
                        disabled={noActions || selected.id === me?.id}
                        value={nextRole}
                        onChange={(e) => setNextRole(e.target.value as Role)}
                      >
                        {roles.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </label>
                    <Button
                      variant="secondary"
                      className="mt-3"
                      disabled={noActions || nextRole === selected.role_code}
                      onClick={() =>
                        beginReview({
                          kind: "role",
                          person: selected,
                          role: nextRole,
                        })
                      }
                    >
                      Review role change
                    </Button>
                  </div>
                  <div className={s.rule}>
                    <h3>Account safeguards</h3>
                    <p className={s.muted}>
                      Review password reset or deactivation before sending the
                      request. Your own administrator account cannot be
                      deactivated here.
                    </p>
                    <div className={`${s.actions} ${s.back}`}>
                      <Button
                        variant="secondary"
                        disabled={noActions}
                        onClick={() =>
                          beginReview({ kind: "reset", person: selected })
                        }
                      >
                        Reset password
                      </Button>
                      <Button
                        variant="danger"
                        disabled={noActions || selected.id === me?.id}
                        onClick={() =>
                          beginReview({ kind: "deactivate", person: selected })
                        }
                      >
                        Deactivate
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2>Access should be intentional.</h2>
                  <p className={`${s.muted} ${s.back}`}>
                    Choose a person from the directory to review their status,
                    change their role or manage account safeguards.
                  </p>
                  <div className={`${s.scopeNote} ${s.back}`}>
                    <strong>Role ≠ scope</strong>
                    <p>
                      A role defines a capability set. Staff assignments supply
                      resource context. Neither a checkbox nor this screen
                      overrides server authorization.
                    </p>
                  </div>
                </>
              )}
              <a className={`${s.link} ${s.back}`} href="#people-directory">
                Back to people list ↓
              </a>
            </aside>
          </div>
        </>
      ) : (
        <section className={s.panel}>
          <div className={s.panelHead}>
            <div>
              <p className={s.eyebrow}>Staff / resource context</p>
              <h2>Assignments & responsibilities</h2>
            </div>
            <Button
              disabled={
                busy ||
                assignments.loading ||
                !meta?.people.length ||
                !Object.keys(meta?.scopes || {}).length
              }
              onClick={() => {
                setFormError(null);
                setAssignmentOpen(true);
              }}
            >
              Add assignment
            </Button>
          </div>
          <p className={s.scopeNote}>
            Resource assignments complement role permissions. Flags apply only
            where a backend policy uses them. Office access currently follows
            office/room scope, not the ticket flag; publishing is restricted to
            the author. An assignment alone is not a promise of access.
          </p>
          <ReadState
            loading={assignments.loading}
            error={assignments.error}
            retry={assignments.refresh}
          />
          {!assignments.loading && !assignments.error && meta ? (
            <>
              {meta.assignments.length ? (
                <ul className={`${s.stack} ${s.back}`}>
                  {meta.assignments.map((a) => (
                    <li className={s.row} key={a.id}>
                      <div>
                        <h3>
                          {a.user_name ||
                            meta.people.find((p) => p.id === a.user_id)?.name ||
                            a.user_id}
                        </h3>
                        <p>
                          {a.scope_type} · {scopeLabel(a)}
                        </p>
                        <p>
                          {a.role_in_scope || "No label"} ·{" "}
                          {[
                            a.can_call_tickets ? "Tickets" : null,
                            a.can_manage_timetable ? "Timetable" : null,
                            a.can_publish_content ? "Content" : null,
                          ]
                            .filter(Boolean)
                            .join(", ") || "No capability flags"}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          beginReview({ kind: "assignment", assignment: a })
                        }
                        aria-label={`Remove assignment ${a.id}`}
                      >
                        Review removal
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty title="No staff assignments">
                  Use Add assignment when eligible staff and resource catalogues
                  are available.
                </Empty>
              )}
              {!meta.people.length || !Object.keys(meta.scopes).length ? (
                <p className={`${s.muted} ${s.back}`}>
                  Eligible staff or scope catalogue unavailable. Creation is
                  disabled rather than asking you to guess IDs.
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      )}
      <Modal
        open={createOpen}
        onClose={() => {
          if (!busy) {
            setCreateOpen(false);
            setDraft(newPerson());
          }
        }}
        title="Create a user"
        description="Choose a role deliberately. Leave password blank to request a generated temporary password."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setCreateOpen(false);
                setDraft(newPerson());
              }}
            >
              Cancel
            </Button>
            <Button loading={busy} form="create-person" type="submit">
              Create user
            </Button>
          </>
        }
      >
        <form
          id="create-person"
          className={`${s.page} ${s.form}`}
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <fieldset disabled={busy} className={s.two}>
            <label className={s.field}>
              Full name
              <input
                required
                maxLength={255}
                autoComplete="off"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label className={s.field}>
              Email
              <input
                required
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </label>
            <label className={s.field}>
              Role
              <select
                value={draft.role_code}
                onChange={(e) =>
                  setDraft({ ...draft, role_code: e.target.value as Role })
                }
              >
                {roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className={s.field}>
              Registration number
              <input
                value={draft.registration_no}
                onChange={(e) =>
                  setDraft({ ...draft, registration_no: e.target.value })
                }
              />
            </label>
            <label className={s.field}>
              Department
              <input
                value={draft.department}
                onChange={(e) =>
                  setDraft({ ...draft, department: e.target.value })
                }
              />
            </label>
            <label className={s.field}>
              Password (optional)
              <input
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={draft.password}
                onChange={(e) =>
                  setDraft({ ...draft, password: e.target.value })
                }
              />
            </label>
          </fieldset>
          {formError ? (
            <p role="alert" className={s.danger}>
              {formError}
            </p>
          ) : null}
        </form>
      </Modal>
      <Modal
        open={assignmentOpen}
        onClose={() => {
          if (!busy) setAssignmentOpen(false);
        }}
        title="Add a staff assignment"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setAssignmentOpen(false)}
            >
              Cancel
            </Button>
            <Button loading={busy} form="create-assignment" type="submit">
              Save assignment
            </Button>
          </>
        }
      >
        <form
          id="create-assignment"
          className={`${s.page} ${s.form}`}
          onSubmit={(e) => {
            e.preventDefault();
            addAssignment();
          }}
        >
          <fieldset className={s.form} disabled={busy}>
            <label className={s.field}>
              Staff member
              <select
                required
                value={assignment.user_id}
                onChange={(e) =>
                  setAssignment({ ...assignment, user_id: e.target.value })
                }
              >
                <option value="">Select a staff member</option>
                {meta?.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.email}
                  </option>
                ))}
              </select>
            </label>
            <div className={s.two}>
              <label className={s.field}>
                Scope type
                <select
                  value={assignment.scope_type}
                  onChange={(e) =>
                    setAssignment({
                      ...assignment,
                      scope_type: e.target.value,
                      scope_id: "",
                    })
                  }
                >
                  {Object.keys(meta?.scopes || {}).map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label className={s.field}>
                Scope
                <select
                  required
                  value={assignment.scope_id}
                  onChange={(e) =>
                    setAssignment({ ...assignment, scope_id: e.target.value })
                  }
                >
                  <option value="">Select a resource</option>
                  {meta?.scopes[assignment.scope_type]?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className={s.field}>
              Responsibility label
              <input
                maxLength={100}
                value={assignment.role_in_scope}
                onChange={(e) =>
                  setAssignment({
                    ...assignment,
                    role_in_scope: e.target.value,
                  })
                }
              />
            </label>
            {(
              [
                ["can_call_tickets", "Ticket operations"],
                ["can_manage_timetable", "Timetable"],
                ["can_publish_content", "Content"],
              ] as const
            ).map(([k, label]) => (
              <label className={s.check} key={k}>
                <input
                  type="checkbox"
                  checked={assignment[k]}
                  onChange={(e) =>
                    setAssignment({ ...assignment, [k]: e.target.checked })
                  }
                />
                {label}
              </label>
            ))}
            <p className={s.scopeNote}>
              Flags do not supersede role permissions or ownership policies.
              Scope choices come from the server, independently of the
              directory’s current search.
            </p>
          </fieldset>
          {formError ? (
            <p role="alert" className={s.danger}>
              {formError}
            </p>
          ) : null}
        </form>
      </Modal>
      <Modal
        open={!!review}
        onClose={() => {
          if (!busy) setReview(null);
        }}
        title={
          review?.kind === "role"
            ? "Confirm role change"
            : review?.kind === "reset"
              ? "Reset this password?"
              : review?.kind === "assignment"
                ? "Remove this assignment?"
                : "Deactivate this user?"
        }
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setReview(null)}
            >
              Cancel
            </Button>
            <Button loading={busy} onClick={confirm}>
              Confirm change
            </Button>
          </>
        }
      >
        <div className={s.page}>
          <p>
            {review?.kind === "assignment"
              ? `Remove ${review.assignment.scope_type} assignment ${scopeLabel(review.assignment)}? Effective access follows the remaining assignments and configured unassigned-staff policy.`
              : review?.kind === "role"
                ? `Change ${review.person.name} from ${review.person.role_code} to ${review.role}? This changes their capability set and is audited separately from profile changes.`
                : review?.kind === "reset"
                  ? `Issue a new temporary password for ${review.person.name}? The previous password will stop working. Existing sessions are governed by server policy.`
                  : review
                    ? `${review.person.name} will no longer be able to sign in. The server soft-deletes the account and retains associated records according to its policies.`
                    : ""}
          </p>
          {formError ? (
            <p role="alert" className={`${s.danger} ${s.back}`}>
              {formError}
            </p>
          ) : null}
        </div>
      </Modal>
      <Modal
        open={!!secret && !review}
        onClose={() => setSecret(null)}
        title="Temporary password"
        footer={<Button onClick={() => setSecret(null)}>Done</Button>}
      >
        <div className={s.page}>
          <p>
            A temporary password was issued for <strong>{secret?.name}</strong>.
            Share it securely. It is cleared from this view when dismissed and
            is not stored in the browser or a toast.
          </p>
          <p className={`${s.secret} ${s.back}`}>{secret?.password}</p>
        </div>
      </Modal>
    </div>
  );
}
