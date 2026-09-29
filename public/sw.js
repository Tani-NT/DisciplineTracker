self.addEventListener("push", function (event) {
  if (!event.data) {
    return;
  }

  let data;

  try {
    data = event.data.json();
  } catch {
    data = {
      title: "DisciplineTracker",
      body: event.data.text(),
    };
  }

  const title = data.title || "DisciplineTracker";

  const options = {
    body: data.body || "You have a task coming up.",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || "discipline-tracker",
    renotify: true,
    data: {
      url: data.url || "/",
      taskId: data.taskId || null,
    },
  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );
});

self.addEventListener(
  "notificationclick",
  function (event) {
    event.notification.close();

    const url =
      event.notification.data?.url || "/";

    event.waitUntil(
      clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      }).then(function (clientList) {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  }
);