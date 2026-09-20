"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Drawer,
  Dropdown,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  LineIcon,
  LoadingState,
  NeonIcon,
  PageHeader,
  Pagination,
  ProgressBar,
  SearchInput,
  SectionTitle,
  Select,
  Skeleton,
  Tabs,
  Toast,
  Tooltip,
} from "../index";

export function M00SmokeFixture() {
  const [tab, setTab] = useState("one");
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="crz-container crz-stack" data-testid="m00-smoke-fixture">
      <PageHeader
        eyebrow="M00"
        title="CRAZZY Design System"
        description="Fixture interno de validação dos componentes do CORE."
        actions={<Button onClick={() => setDialog(true)}>Abrir modal</Button>}
      />

      <Card className="crz-stack" style={{ padding: 16 }}>
        <SectionTitle
          icon={<NeonIcon name="crown" />}
          title="Componentes"
          description="Validação visual interna"
          action={<Badge tone="pink">EXCLUSIVO</Badge>}
        />

        <div className="crz-inline">
          <Button>Primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Perigo</Button>
          <IconButton label="Configurações" icon={<LineIcon name="user" />} />
        </div>

        <Input label="Nome" placeholder="CRAZZY" hint="Campo padrão" />
        <SearchInput label="Busca" placeholder="Pesquisar..." />
        <Select label="Categoria" defaultValue="all">
          <option value="all">Todas</option>
          <option value="games">Jogos</option>
        </Select>
        <Checkbox label="Aceito os termos" defaultChecked />

        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: "one", label: "Visão Geral" },
            { id: "two", label: "Detalhes" },
          ]}
        />

        <ProgressBar value={72} label="Progresso" showValue />
        <Pagination page={2} totalPages={5} />

        <div className="crz-inline">
          <Avatar fallback="CP" />
          <Tooltip content="Tooltip CRAZZY">
            <Button variant="secondary">Passe o mouse</Button>
          </Tooltip>
          <Dropdown
            trigger={<Button variant="secondary">Menu</Button>}
            items={[
              { id: "profile", label: "Perfil" },
              { id: "exit", label: "Sair", danger: true },
            ]}
          />
        </div>

        <Skeleton height={42} />
        <Toast tone="success" icon={<NeonIcon name="verified" size={22} />}>
          Operação concluída.
        </Toast>

        <Button variant="secondary" onClick={() => setDrawer(true)}>Abrir drawer</Button>
      </Card>

      <LoadingState />
      <EmptyState description="Nenhum item encontrado." />
      <ErrorState />

      <ConfirmDialog
        open={dialog}
        title="Confirmar ação"
        description="Fixture de confirmação do M00."
        onConfirm={() => undefined}
        onClose={() => setDialog(false)}
      />

      <Drawer open={drawer} title="Drawer CRAZZY" onClose={() => setDrawer(false)}>
        Conteúdo interno.
      </Drawer>
    </div>
  );
}
