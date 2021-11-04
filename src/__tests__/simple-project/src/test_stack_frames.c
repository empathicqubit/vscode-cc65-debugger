#include <conio.h>

void step_frames() {
    cputs("If you see this after step\n");
    cputs("in, you failed\n");
}

unsigned char test_stack_frames_main(void) {
    step_frames();
    cputs("If you see this after step\n");
    cputs("out, you failed\n");
    return 0;
}