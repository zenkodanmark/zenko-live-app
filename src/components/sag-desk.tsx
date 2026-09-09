import { getRouteApi } from "@tanstack/react-router";
import { SagAsList, SagAsPage, SagErList, SagErPage, SagHome, SagKsList, SagKsPage, SagSamling, SagTbList, SagTbPage, SagTfList, SagTfPage, SagTodoList } from "@/components/sag-pages";
import { SagMissing } from "@/components/sag-shell";
import { useSagSite } from "@/lib/use-sag-site";

const sagIndex = getRouteApi("/sag/$slug/");
const sagAsList = getRouteApi("/sag/$slug/as/");
const sagAsNum = getRouteApi("/sag/$slug/as/$number");
const sagTbList = getRouteApi("/sag/$slug/tb/");
const sagTbNum = getRouteApi("/sag/$slug/tb/$number");
const sagKsList = getRouteApi("/sag/$slug/ks/");
const sagKsNum = getRouteApi("/sag/$slug/ks/$number");
const sagTodoList = getRouteApi("/sag/$slug/todo/");
const sagErList = getRouteApi("/sag/$slug/er/");
const sagErNum = getRouteApi("/sag/$slug/er/$number");
const sagTfList = getRouteApi("/sag/$slug/tf/");
const sagTfNum = getRouteApi("/sag/$slug/tf/$number");
const sagSamling = getRouteApi("/sag/$slug/samling");

export function SagHomeRoute() {
  const { slug } = sagIndex.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing || !site) return <SagMissing />;
  return <SagHome site={site} />;
}
export function SagAsListRoute() {
  const { slug } = sagAsList.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing || !site) return <SagMissing />;
  return <SagAsList site={site} />;
}
export function SagAsRoute() {
  const { slug, number } = sagAsNum.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing || !site) return <SagMissing />;
  return <SagAsPage site={site} number={number} />;
}
export function SagTbListRoute() {
  const { slug } = sagTbList.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing || !site) return <SagMissing />;
  return <SagTbList site={site} />;
}
export function SagTbRoute() {
  const { slug, number } = sagTbNum.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing || !site) return <SagMissing />;
  return <SagTbPage site={site} number={number} />;
}
export function SagKsListRoute() {
  const { slug } = sagKsList.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing || !site) return <SagMissing />;
  return <SagKsList site={site} />;
}
export function SagKsRoute() {
  const { slug, number } = sagKsNum.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing || !site) return <SagMissing />;
  return <SagKsPage site={site} number={number} />;
}
export function SagTodoListRoute() {
  const { slug } = sagTodoList.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing || !site) return <SagMissing />;
  return <SagTodoList site={site} />;
}
export function SagErListRoute() {
  const { slug } = sagErList.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing || !site) return <SagMissing />;
  return <SagErList site={site} />;
}
export function SagErRoute() {
  const { slug, number } = sagErNum.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing || !site) return <SagMissing />;
  return <SagErPage site={site} number={number} />;
}
export function SagTfListRoute() {
  const { slug } = sagTfList.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing || !site) return <SagMissing />;
  return <SagTfList site={site} />;
}
export function SagTfRoute() {
  const { slug, number } = sagTfNum.useParams();
  const { site, missing } = useSagSite(slug);
  if (missing || !site) return <SagMissing />;
  return <SagTfPage site={site} number={number} />;
}
export function SagSamlingRoute() {
  const { slug } = sagSamling.useParams();
  const { n } = sagSamling.useSearch();
  const { site, missing } = useSagSite(slug);
  if (missing || !site) return <SagMissing />;
  const numbers = String(n || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return <SagSamling site={site} numbers={numbers} />;
}
