export const badgeColor = (status: string) => {
    switch (status) {
        case "pending":
            return "bg-yellow-500";
        case "running":
            return "bg-blue-500";
        case "done":
            return "bg-green-500";
        case "failed":
            return "bg-red-500";
        default:
            return "bg-gray-500";
    }
};