import React, { useEffect, useMemo, useState } from "react";
import { AppModal } from "~/components/app-modal";
import { fetchDepartmentHierarchy, createDepartment, type FlatDepartmentNodeResponse } from "~/components/enterpriseApi";
import { SvgIcon } from "~/components/svg-icon";

type StructureNode = {
  id: string;
  parentId: string | null;
  name: string;
  shortName: string;
  depth: number;
  hasChildren: boolean;
  path: string[];
};

type CreateFormState = {
  type: "workshop" | "area";
  name: string;
  shortName: string;
  parentId: string;
};

function normalizeApiDepartments(departments: FlatDepartmentNodeResponse[]): StructureNode[] {
  return departments
    .map((department) => ({
      id: String(department.departmentId ?? "").trim(),
      parentId: department.parentDepartmentId ? String(department.parentDepartmentId).trim() : null,
      name: String(department.name ?? "").trim(),
      shortName: String(department.shortName ?? department.name ?? "").trim(),
      depth: Number.isFinite(Number(department.depth)) ? Number(department.depth) : 0,
      hasChildren: false,
      path: department.path ?? []
    }))
    .filter((department) => department.id && department.name);
}

function getNodeTypeLabel(depth: number): string {
  if (depth <= 0) return "Главный департамент";
  if (depth === 1) return "Цех";
  return "Участок";
}

function getNodeBadgeClass(depth: number): string {
  if (depth <= 0) return "enterprise-structure-badge--root";
  if (depth === 1) return "enterprise-structure-badge--workshop";
  return "enterprise-structure-badge--area";
}

function getDisplayName(node: StructureNode): string {
  return node.shortName || node.name || "Без названия";
}

export default function EnterpriseStructurePage(): React.ReactElement {
  const [departments, setDepartments] = useState<StructureNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchValue, setSearchValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>({
    type: "workshop",
    name: "",
    shortName: "",
    parentId: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadDepartments = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const hierarchy = await fetchDepartmentHierarchy();
      const normalizedDepartments = normalizeApiDepartments(hierarchy);
      setDepartments(normalizedDepartments);
    } catch (error) {
      setDepartments([]);
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить структуру предприятия.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDepartments();
  }, []);

  const childMap = useMemo(() => {
    const map = new Map<string, StructureNode[]>();
    departments.forEach((department) => {
      if (department.parentId) {
        const children = map.get(department.parentId) ?? [];
        children.push(department);
        map.set(department.parentId, children);
      }
    });
    for (const [parentId, children] of map) {
      children.sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), "ru"));
    }
    return map;
  }, [departments]);

  const departmentById = useMemo(() => {
    return new Map(departments.map((department) => [department.id, department]));
  }, [departments]);

  const rootNodes = useMemo(() => {
    const roots = departments.filter((department) => !department.parentId || !departmentById.has(department.parentId));
    return roots.sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), "ru"));
  }, [departmentById, departments]);

  const workshopOptions = useMemo(() => {
    return departments.filter((department) => department.depth === 1);
  }, [departments]);

  const rootOptions = useMemo(() => {
    return departments.filter((department) => department.depth <= 0 || !department.parentId);
  }, [departments]);

  const parentOptions = createForm.type === "workshop" ? rootOptions : workshopOptions;

  useEffect(() => {
    if (!createForm.parentId || !parentOptions.some((d) => d.id === createForm.parentId)) {
      setCreateForm((current) => ({
        ...current,
        parentId: parentOptions[0]?.id ?? ""
      }));
    }
  }, [createForm.type, parentOptions]);

  const normalizedSearch = searchValue.trim().toLowerCase();

  const visibleNodeIds = useMemo(() => {
    if (!normalizedSearch) return new Set(departments.map((department) => department.id));

    const visible = new Set<string>();

    departments.forEach((department) => {
      const searchTarget = `${department.name} ${department.shortName} ${getNodeTypeLabel(department.depth)}`.toLowerCase();
      if (!searchTarget.includes(normalizedSearch)) return;

      const addDescendants = (currentNode: StructureNode): void => {
        visible.add(currentNode.id);
        (childMap.get(currentNode.id) ?? []).forEach((child) => addDescendants(child));
      };

      addDescendants(department);

      let current: StructureNode | undefined = department.parentId ? departmentById.get(department.parentId) : undefined;
      while (current) {
        visible.add(current.id);
        current = current.parentId ? departmentById.get(current.parentId) : undefined;
      }
    });

    return visible;
  }, [childMap, departmentById, departments, normalizedSearch]);

  const statistics = useMemo(() => ({
    roots: departments.filter((department) => department.depth <= 0).length,
    workshops: departments.filter((department) => department.depth === 1).length,
    areas: departments.filter((department) => department.depth >= 2).length
  }), [departments]);

  const visibleRootNodes = rootNodes.filter((node) => visibleNodeIds.has(node.id));

  const toggleNode = (nodeId: string): void => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const openCreateModal = (type: CreateFormState["type"] = "workshop", parentId = ""): void => {
    const options = type === "workshop" ? rootOptions : workshopOptions;
    const resolvedParentId = parentId || options[0]?.id || "";

    setCreateForm({
      type,
      parentId: resolvedParentId,
      name: "",
      shortName: ""
    });
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = (): void => {
    setIsCreateModalOpen(false);
    setCreateForm((current) => ({ ...current, name: "", shortName: "" }));
  };

  const handleSubmitCreate = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!createForm.name.trim() || !createForm.parentId) {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      await createDepartment({
        name: createForm.name.trim(),
        shortName: createForm.shortName.trim() || null,
        parentDepartmentId: createForm.parentId
      });

      closeCreateModal();
      await loadDepartments();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось создать подразделение.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderNode = (node: StructureNode): React.ReactNode => {
    const children = (childMap.get(node.id) ?? []).filter((child) => visibleNodeIds.has(child.id));
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const canCreateWorkshop = node.depth <= 0;
    const canCreateArea = node.depth === 1;

    return (
      <React.Fragment key={node.id}>
        <div className="enterprise-structure-row" style={{ "--node-depth": node.depth } as React.CSSProperties}>
          <button
            type="button"
            className={hasChildren ? "enterprise-structure-toggle" : "enterprise-structure-toggle enterprise-structure-toggle--empty"}
            onClick={() => hasChildren && toggleNode(node.id)}
            aria-label={isExpanded ? "Свернуть" : "Развернуть"}
            disabled={!hasChildren}
          >
            <SvgIcon name="chevron-down" className={isExpanded ? "enterprise-structure-toggle__icon" : "enterprise-structure-toggle__icon enterprise-structure-toggle__icon--closed"} />
          </button>

          <span className="enterprise-structure-folder-icon" aria-hidden="true" />

          <div className="enterprise-structure-node-main">
            <div className="enterprise-structure-node-title-row">
              <span className="enterprise-structure-node-title">{getDisplayName(node)}</span>
              <span className={`enterprise-structure-badge ${getNodeBadgeClass(node.depth)}`}>
                {getNodeTypeLabel(node.depth)}
              </span>
            </div>
            {node.name !== node.shortName ? (
              <span className="enterprise-structure-node-subtitle">{node.name}</span>
            ) : null}
          </div>

          <div className="enterprise-structure-node-meta">
            <span>{children.length} влож.</span>
          </div>

          <div className="enterprise-structure-node-actions">
            {canCreateWorkshop ? (
              <button type="button" className="btn btn--ghost btn--small" onClick={() => openCreateModal("workshop", node.id)}>
                + Цех
              </button>
            ) : null}
            {canCreateArea ? (
              <button type="button" className="btn btn--ghost btn--small" onClick={() => openCreateModal("area", node.id)}>
                + Участок
              </button>
            ) : null}
          </div>
        </div>

        {hasChildren && isExpanded ? children.map((child) => renderNode(child)) : null}
      </React.Fragment>
    );
  };

  return (
    <div className="enterprise-structure-page">
      <div className="ui-page__header enterprise-structure-page__header">
        <div>
          <h1 className="ui-page__title">Структура предприятия</h1>
        </div>

        <div className="enterprise-structure-header-actions">
          <button type="button" className="btn btn--primary" onClick={() => openCreateModal("workshop")}>
            <span className="btn__plus">+</span>
            Создать подразделение
          </button>
        </div>
      </div>

      <div className="ui-divider" />

      <section className="enterprise-structure-stats">
        <div className="enterprise-structure-stat ui-card">
          <span className="enterprise-structure-stat__label">Главные департаменты</span>
          <strong>{statistics.roots}</strong>
        </div>
        <div className="enterprise-structure-stat ui-card">
          <span className="enterprise-structure-stat__label">Цеха</span>
          <strong>{statistics.workshops}</strong>
        </div>
        <div className="enterprise-structure-stat ui-card">
          <span className="enterprise-structure-stat__label">Участки</span>
          <strong>{statistics.areas}</strong>
        </div>
      </section>

      <section className="ui-card enterprise-structure-toolbar-card">
        <div className="ui-card__body enterprise-structure-toolbar">
          <div className="ui-search enterprise-structure-search">
            <span className="ui-search__icon">
              <SvgIcon name="search" />
            </span>
            <input
              className="ui-search__input"
              type="text"
              placeholder="Поиск по структуре..."
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
            {searchValue ? (
              <button type="button" className="ui-search__action" title="Очистить" onClick={() => setSearchValue("")}>
                <SvgIcon name="close" />
              </button>
            ) : null}
          </div>

          <div className="enterprise-structure-toolbar__actions">
            <button type="button" className="btn btn--ghost btn--small" onClick={() => openCreateModal("workshop")} disabled={rootOptions.length === 0}>
              + Цех
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => openCreateModal("area")} disabled={workshopOptions.length === 0}>
              + Участок
            </button>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="enterprise-structure-note enterprise-structure-note--warning">
          {errorMessage}
        </div>
      ) : null}

      <section className="ui-card enterprise-structure-card">
        <div className="ui-card__header enterprise-structure-card__header">
          <div>
            <h2 className="ui-card__title">Список подразделений</h2>
          </div>
        </div>

        <div className="enterprise-structure-tree">
          {isLoading ? (
            <div className="ui-empty">Загрузка структуры предприятия...</div>
          ) : visibleRootNodes.length > 0 ? (
            visibleRootNodes.map((node) => renderNode(node))
          ) : (
            <div className="ui-empty">Подразделения по выбранному поиску не найдены.</div>
          )}
        </div>
      </section>

      <AppModal
        open={isCreateModalOpen}
        title="Создать подразделение"
        onClose={closeCreateModal}
        actions={
          <>
            <button type="button" className="btn btn--ghost" onClick={closeCreateModal}>
              Отмена
            </button>
            <button type="submit" form="enterprise-structure-create-form" className="btn btn--primary" disabled={!createForm.name.trim() || !createForm.parentId || isSubmitting}>
              {isSubmitting ? "Создание..." : "Создать"}
            </button>
          </>
        }
      >
        <form id="enterprise-structure-create-form" className="enterprise-structure-form" onSubmit={handleSubmitCreate}>
          <div className="ui-field">
            <label className="ui-field__label" htmlFor="structure-type">Тип подразделения</label>
            <div className="ui-select-wrap">
              <select
                id="structure-type"
                className="ui-select"
                value={createForm.type}
                onChange={(event) => setCreateForm((current) => ({ ...current, type: event.target.value as CreateFormState["type"], parentId: "" }))}
              >
                <option value="workshop">Цех</option>
                <option value="area">Участок</option>
              </select>
              <SvgIcon name="chevron-down" className="ui-select-wrap__icon" />
            </div>
          </div>

          <div className="ui-field">
            <label className="ui-field__label" htmlFor="structure-parent">Родительское подразделение</label>
            <div className="ui-select-wrap">
              <select
                id="structure-parent"
                className="ui-select"
                value={createForm.parentId}
                onChange={(event) => setCreateForm((current) => ({ ...current, parentId: event.target.value }))}
                disabled={parentOptions.length === 0}
              >
                {parentOptions.length === 0 ? <option value="">Нет доступных родителей</option> : null}
                {parentOptions.map((department) => (
                  <option key={department.id} value={department.id}>
                    {getDisplayName(department)}
                  </option>
                ))}
              </select>
              <SvgIcon name="chevron-down" className="ui-select-wrap__icon" />
            </div>
          </div>

          <div className="ui-field">
            <label className="ui-field__label" htmlFor="structure-name">
              Название <span className="ui-field__required">*</span>
            </label>
            <input
              id="structure-name"
              className="ui-input"
              type="text"
              placeholder={createForm.type === "workshop" ? "Например, Цех №3" : "Например, Участок №8"}
              value={createForm.name}
              onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
              autoFocus
            />
          </div>

          <div className="ui-field">
            <label className="ui-field__label" htmlFor="structure-short-name">Короткое название</label>
            <input
              id="structure-short-name"
              className="ui-input"
              type="text"
              placeholder="Можно оставить пустым"
              value={createForm.shortName}
              onChange={(event) => setCreateForm((current) => ({ ...current, shortName: event.target.value }))}
            />
          </div>
        </form>
      </AppModal>
    </div>
  );
}