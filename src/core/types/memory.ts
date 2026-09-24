export interface MemoryItem {
    key: string;
    value?: string;
}

export class MemoryManager {
    private memory: MemoryItem[] = [];

    public get(): readonly MemoryItem[] {
        return this.memory;
    }

    public update(memory: MemoryItem[]) {
        for (const mem of memory) {
            const index = this.memory.findIndex(m => m.key === mem.key);

            if (mem.value === undefined) {
                if (index !== -1) {
                    this.memory.splice(index, 1);
                }

                continue;
            }

            if (index !== -1) {
                this.memory[index] = mem;
            } else {
                this.memory.push(mem);
            }
        }
    }

    public clear() {
        this.memory = [];
    }
}