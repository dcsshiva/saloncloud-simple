import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoursSettings } from "@/components/salon/HoursSettings";
import { HolidaySettings } from "@/components/salon/HolidaySettings";
import { ServicesSettings } from "@/components/salon/ServicesSettings";
import { StaffSettings } from "@/components/salon/StaffSettings";
import { LocationSettings } from "@/components/salon/LocationSettings";
import { NotificationSettings } from "@/components/salon/NotificationSettings";
import { SubscriptionSettings } from "@/components/salon/SubscriptionSettings";
import { useSalon } from "@/lib/use-salon";

export const Route = createFileRoute("/_salonshell/app/settings")({
  head: () => ({
    meta: [
      { title: "Salon Settings — SalonBook" },
      {
        name: "description",
        content: "Manage business hours, holidays, services, staff, location pin, alerts and your subscription.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Salon Settings — SalonBook" },
      { property: "og:description", content: "Hours, holidays, services, staff, location and subscription." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: context, isLoading } = useSalon();

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!context) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No salon is linked to this account yet.
        </CardContent>
      </Card>
    );
  }

  const isOwner = context.staff.role === "owner";
  const canManage = isOwner || context.staff.can_manage_settings;
  const locked = context.salon.status !== "active";
  const readOnly = !canManage || locked;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {readOnly
            ? "You have operational access — settings are read-only for your role."
            : "Configure how customers can book with you."}
        </p>
      </div>

      <Tabs defaultValue="hours">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="hours">Hours</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
        </TabsList>

        <TabsContent value="hours" className="mt-4">
          <HoursSettings salonId={context.salon.id} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="holidays" className="mt-4">
          <HolidaySettings salonId={context.salon.id} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="services" className="mt-4">
          <ServicesSettings salonId={context.salon.id} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="staff" className="mt-4">
          <StaffSettings salonId={context.salon.id} isOwner={isOwner} />
        </TabsContent>
        <TabsContent value="location" className="mt-4">
          <LocationSettings
            salonId={context.salon.id}
            latitude={context.salon.latitude}
            longitude={context.salon.longitude}
            readOnly={readOnly}
          />
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          <NotificationSettings />
        </TabsContent>
        <TabsContent value="subscription" className="mt-4">
          <SubscriptionSettings salonId={context.salon.id} isOwner={isOwner} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
