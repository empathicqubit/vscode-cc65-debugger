#ifdef __NES__
    unsigned char test_local_vars_main(void);
#endif

// Note: Please do not change the code in this file. Test code should go in the
// separate test files and called using selectCTest in the Jest code.
unsigned char main(void) {
    unsigned char ret;

#ifdef __NES__
    ret = test_local_vars_main();
#else
    ret = (*(unsigned char (*)(void))(*(unsigned int *)(0x3fc)))();
#endif

    return ret;
}