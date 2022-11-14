#ifdef __NES__
    unsigned char test_non_c64_main(void);
#endif

unsigned int* testSelector;

// Note: Please do not change the code in this file. Test code should go in the
// separate test files and called using selectCTest in the Jest code.
unsigned char main(void) {
    unsigned char ret;

#ifdef __NES__
    ret = test_non_c64_main();
#else
    ret = (*(unsigned char (*)(void))(testSelector))();
#endif

    return ret;
}