#include <stdio.h>

void stepOut() {
    printf("If you see this after step\n");
    printf("in, you failed\n");
}

unsigned char test_step_out_main(void) {
    stepOut();
    printf("If you see this after step\n");
    printf("out, you failed\n");
    return 0;
}