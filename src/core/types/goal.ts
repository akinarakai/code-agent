export interface Goal {
    id: string;
    description: string;
    status: "pending" | "in_progress" | "completed";
}

export class GoalManager {
    private goals: Goal[] = [];

    public getGoals(): readonly Goal[] {
        return this.goals;
    }

    public update(goals: Goal[]) {
        for (const goal of goals) {
            const index = this.goals.findIndex(current => current.id === goal.id);

            if (index === -1) {
                this.goals.push(goal);
            } else {
                this.goals[index] = {
                    ...this.goals[index],
                    ...goal
                };
            }
        }
    }

    public clear() {
        this.goals = [];
    }
}