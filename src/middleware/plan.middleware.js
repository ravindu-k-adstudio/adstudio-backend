export const requirePlan = (plans = []) => {
    return (req, res, next) => {
        if (!req.user || !plans.includes(req.user.plan)) {
            return res.status(403).json({ message: "Upgrade your plan" });
        }
        next();
    };
};
