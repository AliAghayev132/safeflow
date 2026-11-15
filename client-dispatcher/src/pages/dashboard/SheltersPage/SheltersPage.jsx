// Redux
import { useSelector } from "react-redux";
import { selectShelters, selectZoneById } from "@store/slices/liveSlice";
import { useUpdateShelterMutation } from "@store/api";
import { useAction } from "@store/hooks";

// i18n
import { useTranslation } from "react-i18next";

// Components
import {
  Table,
  Icon3D,
  ProgressBar,
  Button,
  StatCard,
  StatusBadge,
  ShelterActions,
  hasShelterActions,
} from "@components";

// Constants / utils
import { SHELTER_TYPES, SHELTER_LEVEL } from "@constants";
import {
  formatNumber,
  formatPercent,
  occupancyColor,
  shelterLevelKey,
} from "@utils";
import { useCan, useThresholds } from "@hooks";

export const SheltersPage = () => {
  const { t } = useTranslation();
  const thresholds = useThresholds();
  const shelters = useSelector(selectShelters);
  const zones = useSelector(selectZoneById);
  const canManage = useCan("shelter:manage");
  const run = useAction();
  const [updateShelter, { isLoading, originalArgs }] =
    useUpdateShelterMutation();

  const active = shelters.filter((s) => s.isActive);
  const capacity = active.reduce((sum, s) => sum + s.capacity, 0);
  const occupancy = active.reduce((sum, s) => sum + s.occupancy, 0);
  const full = active.filter(
    (s) => s.occupancyRate >= thresholds.reroute,
  ).length;
  const pct = (v) => Math.round(v * 100);

  const toggle = (s) =>
    run(
      updateShelter({ id: s.id, isActive: !s.isActive }),
      s.isActive ? "toast.shelterClosed" : "toast.shelterOpened",
      {
        name: s.name,
      },
    );

  return (
    <div className="p-5 space-y-4">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        <StatCard
          icon="stadium"
          title={t("sheltersPage.active")}
          value={active.length}
          hint={t("sheltersPage.activeHint", {
            count: shelters.length - active.length,
          })}
        />
        <StatCard
          icon="people"
          title={t("sheltersPage.placed")}
          value={formatNumber(occupancy)}
          hint={t("sheltersPage.placedHint", {
            capacity: formatNumber(capacity),
          })}
        />
        <StatCard
          icon="chart"
          title={t("sheltersPage.total")}
          value={formatPercent(capacity ? occupancy / capacity : 0)}
        />
        <StatCard
          icon="warning"
          title={t("sheltersPage.full", { reroute: pct(thresholds.reroute) })}
          value={full}
          hint={t("sheltersPage.fullHint")}
          tone={full ? "critical" : "neutral"}
        />
      </div>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>{t("sheltersPage.columns.shelter")}</Table.Th>
            <Table.Th>{t("sheltersPage.columns.type")}</Table.Th>
            <Table.Th>{t("sheltersPage.columns.zone")}</Table.Th>
            <Table.Th className="w-64">
              {t("sheltersPage.columns.occupancy")}
            </Table.Th>
            <Table.Th>{t("sheltersPage.columns.inflow")}</Table.Th>
            <Table.Th>{t("sheltersPage.columns.status")}</Table.Th>
            {(canManage || hasShelterActions) && (
              <Table.Th className="text-right">
                {t("sheltersPage.columns.action")}
              </Table.Th>
            )}
          </tr>
        </Table.Head>
        <tbody>
          {shelters.map((s) => {
            const levelKey =
              s.isActive &&
              s.isReserve &&
              shelterLevelKey(s, thresholds) === "normal"
                ? "reserveOpen"
                : shelterLevelKey(s, thresholds);
            return (
              <Table.Row key={s.id} className={s.isActive ? "" : "opacity-70"}>
                <Table.Td>
                  <div className="flex items-center gap-3">
                    <Icon3D
                      name={SHELTER_TYPES[s.type]?.icon}
                      size={30}
                      className={s.isActive ? "" : "grayscale"}
                    />
                    <div className="min-w-0">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted">
                        {s.code} · {s.address}
                      </p>
                    </div>
                  </div>
                </Table.Td>
                <Table.Td className="text-muted">
                  {t(`shelterType.${s.type}`)}
                </Table.Td>
                <Table.Td className="text-muted">
                  {zones[s.zone]?.name ?? t("app.none")}
                </Table.Td>
                <Table.Td>
                  <div className="flex justify-between text-xs mb-1 tabular-nums">
                    <span className="text-muted">
                      {formatNumber(s.occupancy)} / {formatNumber(s.capacity)}
                    </span>
                    <strong
                      style={{
                        color: s.isActive
                          ? occupancyColor(s.occupancyRate)
                          : undefined,
                      }}
                    >
                      {formatPercent(s.occupancyRate)}
                    </strong>
                  </div>
                  <ProgressBar
                    value={s.occupancyRate}
                    color={
                      s.isActive ? occupancyColor(s.occupancyRate) : "#5D6A84"
                    }
                    marker={thresholds.reroute}
                  />
                </Table.Td>
                <Table.Td className="text-xs whitespace-nowrap">
                  {s.isActive && s.inflowPerMin > 0 ? (
                    <>
                      <p className="text-muted">
                        {t("map.inflow", { value: s.inflowPerMin })}
                      </p>
                      {Number.isFinite(s.fillEtaMin) && (
                        <p
                          className={
                            s.fillingFast
                              ? "text-warning font-semibold"
                              : "text-text"
                          }
                        >
                          ⏱{" "}
                          {t("map.fillEta", {
                            minutes: Math.round(s.fillEtaMin),
                          })}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-subtle">
                      {t("sheltersPage.noInflow")}
                    </span>
                  )}
                </Table.Td>
                <Table.Td>
                  <StatusBadge
                    meta={SHELTER_LEVEL[levelKey]}
                    label={t(`shelterLevel.${levelKey}`, {
                      reroute: pct(thresholds.reroute),
                      alert: pct(thresholds.alert),
                    })}
                  />
                </Table.Td>
                {(canManage || hasShelterActions) && (
                  <Table.Td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ShelterActions shelter={s} compact />
                      {canManage && (
                        <Button
                          size="sm"
                          variant={s.isActive ? "outline" : "success"}
                          loading={isLoading && originalArgs?.id === s.id}
                          onClick={() => toggle(s)}
                        >
                          {s.isActive
                            ? t("sheltersPage.close")
                            : t("sheltersPage.open")}
                        </Button>
                      )}
                    </div>
                  </Table.Td>
                )}
              </Table.Row>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
};
