#include <stdio.h>

void step_frames() {
    printf("If you see this after step\n");
    printf("in, you failed\n");
}

unsigned char test_stack_frames_main(void) {
    step_frames();
    printf("If you see this after step\n");
    printf("out, you failed\n");
    return 0;
}