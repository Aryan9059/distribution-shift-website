class PersistenceGate:
    """Opens after m consecutive alarms (D > tau); closes after k consecutive non-alarms."""

    def __init__(self, tau: float, m: int, k: int):
        self.tau, self.m, self.k = tau, m, k
        self.open, self.alarms, self.quiet = False, 0, 0

    def update(self, score: float) -> tuple[bool, bool]:
        """Returns (adapt_now, just_closed)."""
        alarm = score > self.tau
        just_closed = False
        if not self.open:
            self.alarms = self.alarms + 1 if alarm else 0
            if self.alarms >= self.m:
                self.open, self.quiet = True, 0
        else:
            self.quiet = 0 if alarm else self.quiet + 1
            if self.quiet >= self.k:
                self.open, self.alarms, just_closed = False, 0, True
        return self.open, just_closed
